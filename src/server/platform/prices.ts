import { addDaysIso } from "@/lib/plan-change";
import { PLAN_ORDER, planByKey, type Plan, type PlanKey } from "@/lib/plans";
import { monthlyRevenue, todayIso } from "./billing";
import { platformDb, writeAudit, type PlatformContext } from "./auth";
import { czDate, queueCompanyEmail, SIGNATURE } from "./email";

/**
 * Ceník v databázi (tabulka plans). Změna ceny = nový řádek s valid_from, starý zůstává. Firmy na daném tarifu dostanou
 * zamčenou původní cenu (companies.locked_plan_id): při `new_only` napořád, při `all_after_notice` na 30 dní, potom se
 * zámek uvolní a platí nový ceník. Funkce tarifů (co který tarif obsahuje) zůstávají v kódu a SQL.
 */
export interface PlanPriceRow {
  id: string;
  code: PlanKey;
  name: string;
  user_limit: number | null;
  included_users: number | null;
  price_monthly: number;
  price_yearly: number;
  price_extra_user_monthly: number | null;
  price_extra_user_yearly: number | null;
  valid_from: string;
}

export type ApplyTo = "new_only" | "all_after_notice";
export const NOTICE_DAYS = 30;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export function normalizeRow(r: PlanPriceRow): PlanPriceRow {
  return { ...r, price_monthly: Number(r.price_monthly), price_yearly: Number(r.price_yearly), price_extra_user_monthly: num(r.price_extra_user_monthly), price_extra_user_yearly: num(r.price_extra_user_yearly) };
}

/** Cena z řádku ceníku ve tvaru, který zná funkce planPrice. */
export function rowToPlan(row: PlanPriceRow): Partial<Plan> {
  return {
    monthly: row.price_monthly,
    yearly: row.price_yearly,
    extraPerUserMonthly: row.price_extra_user_monthly ?? undefined,
    extraPerUserYearly: row.price_extra_user_yearly ?? undefined,
    includedUsers: row.included_users ?? undefined,
  };
}

/** Řádek platný dnes pro každý tarif: nejnovější s valid_from <= dnes. */
export function currentRows(rows: readonly PlanPriceRow[], today: string): Map<string, PlanPriceRow> {
  const out = new Map<string, PlanPriceRow>();
  for (const r of [...rows].sort((a, b) => (a.valid_from < b.valid_from ? -1 : 1))) if (r.valid_from <= today) out.set(r.code, r);
  return out;
}

/** Cena, kterou firma skutečně platí: zamčený řádek, jinak aktuální ceník. */
export function effectiveRow(company: { plan: string; locked_plan_id: string | null }, byId: ReadonlyMap<string, PlanPriceRow>, current: ReadonlyMap<string, PlanPriceRow>): PlanPriceRow | undefined {
  if (company.locked_plan_id && byId.has(company.locked_plan_id)) return byId.get(company.locked_plan_id);
  return current.get(planByKey(company.plan).key);
}

export async function loadPriceRows(): Promise<PlanPriceRow[]> {
  const { data } = await platformDb().from("plans").select("id, code, name, user_limit, included_users, price_monthly, price_yearly, price_extra_user_monthly, price_extra_user_yearly, valid_from").order("valid_from");
  return ((data ?? []) as PlanPriceRow[]).map(normalizeRow);
}

export interface PriceInput {
  price_monthly: number;
  price_yearly: number;
  price_extra_user_monthly: number | null;
  price_extra_user_yearly: number | null;
}

export interface PreviewCompany {
  id: string;
  plan: string;
  addons: string[] | null;
  billing_period: string;
  users: number;
  discount_pct: number;
  is_test: boolean;
  status: string;
  locked_plan_id: string | null;
}

export interface PricePreview {
  /** Firmy, kterým se cena změní (u new_only nikdo, jen noví zákazníci). */
  affected: number;
  /** Firmy, které dostanou zamčenou původní cenu. */
  locked: number;
  mrrBefore: number;
  mrrAfter: number;
  delta: number;
  effectiveFrom: string;
}

/** Dopad změny ceny jednoho tarifu na MRR. `companies` jsou všechny firmy (filtruje se tady). */
export function previewPriceChange(companies: readonly PreviewCompany[], code: PlanKey, oldRow: PlanPriceRow, next: PriceInput, applyTo: ApplyTo, today: string): PricePreview {
  const onPlan = companies.filter((c) => planByKey(c.plan).key === code && !c.is_test && c.status !== "deleted");
  const newPlan: Partial<Plan> = { ...rowToPlan(oldRow), monthly: next.price_monthly, yearly: next.price_yearly, extraPerUserMonthly: next.price_extra_user_monthly ?? undefined, extraPerUserYearly: next.price_extra_user_yearly ?? undefined };
  const rev = (c: PreviewCompany, override: Partial<Plan>) => (c.status === "active" ? monthlyRevenue({ plan: c.plan, addons: c.addons, billingPeriod: c.billing_period, users: c.users, discountPct: c.discount_pct, priceOverride: override }) : 0);
  const free = onPlan.filter((c) => !c.locked_plan_id);
  const mrrBefore = free.reduce((s, c) => s + rev(c, rowToPlan(oldRow)), 0);
  const mrrAfter = applyTo === "all_after_notice" ? free.reduce((s, c) => s + rev(c, newPlan), 0) : mrrBefore;
  return {
    affected: applyTo === "all_after_notice" ? free.filter((c) => c.status === "active" && oldRow.price_monthly + next.price_monthly > 0).length : 0,
    locked: free.length,
    mrrBefore,
    mrrAfter,
    delta: mrrAfter - mrrBefore,
    effectiveFrom: applyTo === "all_after_notice" ? addDaysIso(today, NOTICE_DAYS) : today,
  };
}

export function validatePriceInput(v: Record<string, unknown>): PriceInput | { error: string } {
  const p = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number(String(x).replace(",", ".")));
  const monthly = p(v.price_monthly);
  const yearly = p(v.price_yearly);
  const extraM = p(v.price_extra_user_monthly);
  const extraY = p(v.price_extra_user_yearly);
  const ok = (n: number | null) => n !== null && Number.isFinite(n) && n >= 0 && n <= 1_000_000;
  if (!ok(monthly) || !ok(yearly)) return { error: "Měsíční i roční cena musí být číslo od 0 do 1 000 000." };
  if ((extraM !== null && !ok(extraM)) || (extraY !== null && !ok(extraY))) return { error: "Cena za dalšího uživatele musí být číslo od 0." };
  return { price_monthly: monthly!, price_yearly: yearly!, price_extra_user_monthly: extraM, price_extra_user_yearly: extraY };
}

export const isPlanKey = (v: unknown): v is PlanKey => typeof v === "string" && (PLAN_ORDER as string[]).includes(v);

/** Uloží novou verzi ceny, zamkne stávajícím firmám původní cenu a případně rozešle oznámení a naplánuje uvolnění zámku. */
export async function applyPriceChange(ctx: PlatformContext, code: PlanKey, next: PriceInput, applyTo: ApplyTo): Promise<{ ok: true; locked: number; notified: number; effectiveFrom: string } | { ok: false; code: string; message: string }> {
  const db = platformDb();
  const today = todayIso();
  const rows = await loadPriceRows();
  const oldRow = currentRows(rows, today).get(code);
  if (!oldRow) return { ok: false, code: "no_price", message: "Tarif nemá v ceníku výchozí cenu. Spusťte migraci." };
  if (rows.some((r) => r.code === code && r.valid_from >= today && r.id !== oldRow.id)) return { ok: false, code: "conflict", message: "Cenu tohoto tarifu už dnes někdo změnil." };
  if (oldRow.valid_from === today) return { ok: false, code: "conflict", message: "Cena tohoto tarifu se dnes už měnila. Zkuste to zítra." };

  const { data: inserted, error } = await db
    .from("plans")
    .insert({ code, name: oldRow.name, user_limit: oldRow.user_limit, included_users: oldRow.included_users, ...next, valid_from: today, created_by: ctx.userId })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, code: "insert_failed", message: "Ceník se nepodařilo uložit." };

  const codes = code === "pro" ? ["pro", "enterprise"] : [code];
  const { data: locked } = await db.from("companies").update({ locked_plan_id: oldRow.id }).in("plan", codes).is("locked_plan_id", null).neq("status", "deleted").select("id, plan_paid_until");
  const lockedList = (locked ?? []) as { id: string }[];

  let notified = 0;
  const effectiveFrom = applyTo === "all_after_notice" ? addDaysIso(today, NOTICE_DAYS) : today;
  if (applyTo === "all_after_notice") {
    await db.from("platform_jobs").insert({ type: "plans.unlock", payload: { plan_code: code, old_plan_id: oldRow.id, new_plan_id: inserted.id }, run_at: `${effectiveFrom}T05:00:00Z`, created_by: ctx.userId });
    if (oldRow.price_monthly > 0 || next.price_monthly > 0) {
      const { data: paying } = await db.from("companies").select("id").in("plan", codes).eq("is_test", false).in("status", ["active", "suspended"]);
      for (const c of (paying ?? []) as { id: string }[]) {
        notified += await queueCompanyEmail(
          c.id,
          `Změna ceny tarifu ${oldRow.name} od ${czDate(effectiveFrom)}`,
          `Dobrý den,\n\nod ${czDate(effectiveFrom)} se mění cena tarifu ${oldRow.name}: z ${oldRow.price_monthly.toLocaleString("cs-CZ")} Kč na ${next.price_monthly.toLocaleString("cs-CZ")} Kč měsíčně (roční platba z ${oldRow.price_yearly.toLocaleString("cs-CZ")} Kč na ${next.price_yearly.toLocaleString("cs-CZ")} Kč). Do tohoto data platí vaše dosavadní cena.${SIGNATURE}`
        );
      }
    }
  }
  await writeAudit(ctx, { action: "pricing.change", details: { plan: code, from: { monthly: oldRow.price_monthly, yearly: oldRow.price_yearly }, to: next, applyTo, locked: lockedList.length, notified, effectiveFrom } });
  return { ok: true, locked: lockedList.length, notified, effectiveFrom };
}
