import { createClient } from "@/lib/supabase/client";

export type BalanceCategory = "vacation" | "sick";

export interface Balance {
  /** Entitlement for the year, including any carried-over days. */
  total: number;
  /** Already taken (opening balance + approved absences that ended before today). */
  used: number;
  /** Approved but still ahead. */
  upcoming: number;
  carryover: number;
}

export const remainingOf = (b: Balance) => b.total - b.used - b.upcoming;

interface EntRow {
  profile_id: string;
  year: number;
  total_days: number;
  opening_used_days: number;
  leave_type: { counts_against: string } | null;
}
interface ReqRow {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  leave_type: { counts_against: string } | null;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + Number(x), 0);

/**
 * Balance for ONE calendar year. Only absences starting in that year count
 * against it (earlier years used to leak into the current balance).
 * Vacation also gets last year's unused days (capped by max_carryover_days);
 * carried-over days are used first, so whatever is still unused after the
 * carryover expiry date (MM-DD) is forfeited.
 */
export function computeBalance(
  cat: BalanceCategory,
  ents: EntRow[],
  reqs: ReqRow[],
  year: number,
  today: string,
  carry: { max: number | null; expiryMD: string | null }
): Balance {
  const catEnts = ents.filter((e) => e.leave_type?.counts_against === cat);
  const catReqs = reqs.filter((r) => r.leave_type?.counts_against === cat);
  const inYear = (r: ReqRow, y: number) => r.start_date.startsWith(String(y));

  const curEnts = catEnts.filter((e) => e.year === year);
  const prevEnts = catEnts.filter((e) => e.year === year - 1);

  let carryover = 0;
  if (cat === "vacation" && prevEnts.length > 0) {
    const prevUsed = sum(prevEnts.map((e) => e.opening_used_days)) + sum(catReqs.filter((r) => inYear(r, year - 1)).map((r) => r.working_days));
    carryover = Math.max(0, sum(prevEnts.map((e) => e.total_days)) - prevUsed);
    if (carry.max !== null) carryover = Math.min(carryover, carry.max);
    if (carry.expiryMD) {
      const expiry = `${year}-${carry.expiryMD}`;
      if (today > expiry) {
        const usedBeforeExpiry = sum(catReqs.filter((r) => inYear(r, year) && r.end_date <= expiry).map((r) => r.working_days));
        carryover = Math.min(carryover, usedBeforeExpiry);
      }
    }
  }

  const yearReqs = catReqs.filter((r) => inYear(r, year));
  return {
    total: sum(curEnts.map((e) => e.total_days)) + carryover,
    used: sum(curEnts.map((e) => e.opening_used_days)) + sum(yearReqs.filter((r) => r.end_date < today).map((r) => r.working_days)),
    upcoming: sum(yearReqs.filter((r) => r.end_date >= today).map((r) => r.working_days)),
    carryover,
  };
}

/** Loads entitlements + approved absences (this and last year) once and returns a per-profile balance getter. */
export async function loadBalances(companyId: string, opts: { profileId?: string; excludeRequestId?: string } = {}) {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString("sv-SE");

  let entQ = supabase
    .from("leave_entitlements")
    .select("profile_id, year, total_days, opening_used_days, leave_type:leave_types(counts_against)")
    .in("year", [year - 1, year]);
  let reqQ = supabase
    .from("leave_requests")
    .select("id, profile_id, start_date, end_date, working_days, leave_type:leave_types(counts_against)")
    .eq("status", "approved")
    .gte("start_date", `${year - 1}-01-01`);
  if (opts.profileId) {
    entQ = entQ.eq("profile_id", opts.profileId);
    reqQ = reqQ.eq("profile_id", opts.profileId);
  }

  const [{ data: ents }, { data: reqs }, { data: company }] = await Promise.all([
    entQ,
    reqQ,
    supabase.from("companies").select("max_carryover_days, carryover_expiry_md").eq("id", companyId).single(),
  ]);

  const entRows = (ents as unknown as EntRow[]) ?? [];
  const reqRows = ((reqs as unknown as ReqRow[]) ?? []).filter((r) => r.id !== opts.excludeRequestId);
  const carry = {
    max: company?.max_carryover_days !== null && company?.max_carryover_days !== undefined ? Number(company.max_carryover_days) : null,
    expiryMD: (company?.carryover_expiry_md as string | null) ?? null,
  };

  return {
    get(profileId: string, cat: BalanceCategory): Balance {
      return computeBalance(
        cat,
        entRows.filter((e) => e.profile_id === profileId),
        reqRows.filter((r) => r.profile_id === profileId),
        year,
        today,
        carry
      );
    },
  };
}

export interface HomeOfficeYear {
  /** Approved home-office days starting this year (already taken + planned). */
  used: number;
  thisMonth: number;
  /** Yearly allowance from company defaults; null = no limit configured. */
  limit: number | null;
}

/** Home office is counted per calendar year (allowance = companies.default_home_office_days, 0 = unlimited). */
export async function loadHomeOfficeYear(companyId: string, profileId: string): Promise<HomeOfficeYear> {
  const supabase = createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: reqs }, { data: company }] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("working_days, start_date, leave_type:leave_types(key)")
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .gte("start_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`),
    supabase.from("companies").select("default_home_office_days").eq("id", companyId).single(),
  ]);
  const { data: own } = await supabase
    .from("leave_entitlements")
    .select("total_days, leave_type:leave_types!inner(key)")
    .eq("profile_id", profileId)
    .eq("year", year)
    .eq("leave_type.key", "home_office")
    .maybeSingle();

  const rows = ((reqs as unknown as { working_days: number; start_date: string; leave_type: { key: string } | null }[]) ?? []).filter(
    (r) => r.leave_type?.key === "home_office"
  );
  // A per-employee entitlement row overrides the company-wide default.
  const limit = own ? Number((own as unknown as { total_days: number }).total_days) : Number(company?.default_home_office_days ?? 0);
  return {
    used: sum(rows.map((r) => r.working_days)),
    thisMonth: sum(rows.filter((r) => r.start_date.startsWith(month)).map((r) => r.working_days)),
    limit: limit > 0 ? limit : null,
  };
}
