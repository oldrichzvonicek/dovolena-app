import { addDaysIso } from "@/lib/plan-change";
import { fetchAll } from "@/lib/fetch-all";
import { PLANS, planByKey, userLimitOf } from "@/lib/plans";
import { isOverdue, monthlyRevenue, todayIso } from "./billing";
import { currentRows, effectiveRow, loadPriceRows, rowToPlan, type PlanPriceRow } from "./prices";
import { platformDb } from "./auth";

export interface CompanyRow {
  id: string;
  seq_id: number;
  name: string;
  plan: string;
  addons: string[] | null;
  billing_period: string;
  plan_paid_until: string | null;
  pending_plan: string | null;
  pending_plan_from: string | null;
  status: "active" | "suspended" | "pending_deletion" | "deleted";
  discount_pct: number;
  is_test: boolean;
  last_activity_at: string | null;
  created_at: string;
  locked_plan_id: string | null;
  deletion_scheduled_at: string | null;
  deletion_reason: string | null;
}

export interface CompanyListItem extends CompanyRow {
  users: number;
  mrr: number;
  overdueInvoices: number;
  attention: AttentionReason[];
}

export type AttentionReason = "overdue" | "expired" | "expiring" | "near_limit" | "over_limit" | "pending_plan";

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  overdue: "Faktura po splatnosti",
  expired: "Platnost tarifu skončila",
  expiring: "Platnost tarifu brzy končí",
  near_limit: "Blízko limitu uživatelů",
  over_limit: "Nad limitem uživatelů",
  pending_plan: "Naplánovaná změna tarifu",
};

const COMPANY_COLUMNS = "id, seq_id, name, plan, addons, billing_period, plan_paid_until, pending_plan, pending_plan_from, status, discount_pct, is_test, last_activity_at, created_at, locked_plan_id, deletion_scheduled_at, deletion_reason";

export type CompanyFilter = "all" | "overdue" | "paid_until_soon" | "near_limit" | "free" | "inactive" | "suspended" | "pending_deletion" | "test";
export type CompanySort = "name" | "users" | "mrr" | "created" | "paid_until";

export const FILTER_LABELS: Record<CompanyFilter, string> = {
  all: "Všechny",
  overdue: "Po splatnosti",
  paid_until_soon: "Končí platnost",
  near_limit: "Blízko limitu",
  free: "Free",
  inactive: "Neaktivní",
  suspended: "Pozastavené",
  pending_deletion: "Ke smazání",
  test: "Testovací",
};

/** Počet aktivních uživatelů (bez ukázkových účtů) po firmách. */
async function activeUserCounts(): Promise<Map<string, number>> {
  const { data } = await fetchAll<{ company_id: string | null }>((from, to) =>
    platformDb().from("profiles").select("company_id").eq("active", true).eq("is_demo", false).not("company_id", "is", null).order("id").range(from, to)
  );
  const map = new Map<string, number>();
  for (const p of data) if (p.company_id) map.set(p.company_id, (map.get(p.company_id) ?? 0) + 1);
  return map;
}

/** Firmy s vystavenou fakturou po splatnosti → počet takových faktur. */
async function overdueCounts(today: string): Promise<Map<string, number>> {
  const { data } = await platformDb().from("company_invoices").select("company_id, status, due_at").eq("status", "issued").lt("due_at", today);
  const map = new Map<string, number>();
  for (const i of (data ?? []) as { company_id: string; status: string; due_at: string | null }[]) {
    if (isOverdue(i, today)) map.set(i.company_id, (map.get(i.company_id) ?? 0) + 1);
  }
  return map;
}

function priceOf(c: CompanyRow, byId: Map<string, PlanPriceRow>, current: Map<string, PlanPriceRow>) {
  const row = effectiveRow(c, byId, current);
  return row ? rowToPlan(row) : undefined;
}

export function attentionFor(c: CompanyRow, users: number, overdueInvoices: number, today: string): AttentionReason[] {
  const out: AttentionReason[] = [];
  if (overdueInvoices > 0) out.push("overdue");
  const paid = planByKey(c.plan).monthly > 0;
  if (paid && c.plan_paid_until) {
    if (c.plan_paid_until < today) out.push("expired");
    else if (c.plan_paid_until <= addDaysIso(today, 7)) out.push("expiring");
  }
  const limit = userLimitOf(c.plan);
  if (limit !== null) {
    if (users > limit) out.push("over_limit");
    else if (users >= Math.ceil(limit * 0.9)) out.push("near_limit");
  }
  if (c.pending_plan) out.push("pending_plan");
  return out;
}

export async function loadOverview(): Promise<CompanyListItem[]> {
  const today = todayIso();
  const [{ data: companies, error }, users, overdue, priceRows] = await Promise.all([
    fetchAll<CompanyRow>((from, to) => platformDb().from("companies").select(COMPANY_COLUMNS).order("id").range(from, to)),
    activeUserCounts(),
    overdueCounts(today),
    loadPriceRows().catch(() => []),
  ]);
  if (error) throw new Error(error.message);
  const current = currentRows(priceRows, today);
  const byId = new Map(priceRows.map((r) => [r.id, r]));
  return companies.map((c) => {
    const u = users.get(c.id) ?? 0;
    const o = overdue.get(c.id) ?? 0;
    return {
      ...c,
      discount_pct: Number(c.discount_pct ?? 0),
      status: c.status ?? "active",
      users: u,
      mrr: c.status === "active" || !c.status ? monthlyRevenue({ plan: c.plan, addons: c.addons, billingPeriod: c.billing_period, users: u, discountPct: Number(c.discount_pct ?? 0), priceOverride: priceOf(c, byId, current) }) : 0,
      overdueInvoices: o,
      attention: attentionFor(c, u, o, today),
    };
  });
}

/**
 * Poslední aktivita firmy = nejnovější žádost o absenci jejích lidí za 90 dní. Čistý výpočet, nic nezapisuje —
 * pro zobrazení stačí, a běžné otevření seznamu Firem tak nedělá zápisy do databáze (viz refreshActivity níže).
 */
async function computeActivity(): Promise<Map<string, string>> {
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await fetchAll<{ created_at: string; profile: { company_id: string | null } | { company_id: string | null }[] | null }>((from, to) =>
    platformDb().from("leave_requests").select("created_at, profile:profiles!leave_requests_profile_id_fkey(company_id)").gte("created_at", since).order("id").range(from, to)
  );
  const latest = new Map<string, string>();
  for (const r of data) {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    if (p?.company_id && (!latest.get(p.company_id) || latest.get(p.company_id)! < r.created_at)) latest.set(p.company_id, r.created_at);
  }
  return latest;
}

/**
 * Přepočítá a ULOŽÍ last_activity_at do companies. Voláno jen z pozadí (úloha activity.refresh, viz jobs.ts) —
 * nikdy ne z běžného zobrazení seznamu, aby čtení stránky nedělalo zápisy do databáze.
 */
export async function refreshActivity(items: Pick<CompanyListItem, "id" | "last_activity_at">[]): Promise<number> {
  const latest = await computeActivity();
  let updated = 0;
  for (const c of items) {
    const at = latest.get(c.id) ?? null;
    if (at && at !== c.last_activity_at) {
      await platformDb().from("companies").update({ last_activity_at: at }).eq("id", c.id);
      updated++;
    }
  }
  return updated;
}

/** Aktivita pro zobrazení v seznamu — spočítá čerstvě, ale bez zápisu (uložená last_activity_at se aktualizuje na pozadí). */
export async function withDisplayActivity(items: CompanyListItem[]): Promise<CompanyListItem[]> {
  const latest = await computeActivity();
  for (const c of items) c.last_activity_at = latest.get(c.id) ?? c.last_activity_at;
  return items;
}

export function applyFilter(items: CompanyListItem[], filter: CompanyFilter, today: string): CompanyListItem[] {
  const soon = addDaysIso(today, 14);
  const inactiveBefore = new Date(Date.now() - 60 * 86_400_000).toISOString();
  switch (filter) {
    case "overdue":
      return items.filter((c) => c.overdueInvoices > 0);
    case "paid_until_soon":
      return items.filter((c) => planByKey(c.plan).monthly > 0 && !!c.plan_paid_until && c.plan_paid_until <= soon);
    case "near_limit":
      return items.filter((c) => c.attention.includes("near_limit") || c.attention.includes("over_limit"));
    case "free":
      return items.filter((c) => planByKey(c.plan).monthly === 0 && !c.is_test);
    case "inactive":
      return items.filter((c) => !c.is_test && (c.last_activity_at ?? c.created_at) < inactiveBefore && c.created_at < inactiveBefore);
    case "suspended":
      return items.filter((c) => c.status === "suspended");
    case "pending_deletion":
      return items.filter((c) => c.status === "pending_deletion");
    case "test":
      return items.filter((c) => c.is_test);
    default:
      return items.filter((c) => !c.is_test || filter === "all");
  }
}

export function applySearch(items: CompanyListItem[], q: string): CompanyListItem[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((c) => c.name.toLowerCase().includes(needle) || String(c.seq_id) === needle.replace(/^#/, ""));
}

export function applySort(items: CompanyListItem[], sort: CompanySort, desc: boolean): CompanyListItem[] {
  const dir = desc ? -1 : 1;
  const key = (c: CompanyListItem): string | number => {
    switch (sort) {
      case "users":
        return c.users;
      case "mrr":
        return c.mrr;
      case "created":
        return c.created_at;
      case "paid_until":
        return c.plan_paid_until ?? "9999-12-31";
      default:
        return c.name.toLowerCase();
    }
  };
  return [...items].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir;
  });
}

// ---------------------------------------------------------------------------
// Přehled (dashboard)
// ---------------------------------------------------------------------------

export interface DashboardStats {
  companies: number;
  paying: number;
  free: number;
  newLast30Days: number;
  mrr: number;
  arr: number;
  users: number;
  byPlan: { key: string; name: string; companies: number; mrr: number }[];
  byStatus: Record<string, number>;
  overdueInvoices: number;
  attention: CompanyListItem[];
}

export async function loadDashboard(): Promise<DashboardStats> {
  const all = await loadOverview();
  const real = all.filter((c) => !c.is_test && c.status !== "deleted");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const mrr = real.reduce((s, c) => s + c.mrr, 0);
  const byStatus: Record<string, number> = {};
  for (const c of real) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
  return {
    companies: real.length,
    paying: real.filter((c) => c.mrr > 0).length,
    free: real.filter((c) => planByKey(c.plan).monthly === 0).length,
    newLast30Days: real.filter((c) => c.created_at >= since).length,
    mrr,
    arr: mrr * 12,
    users: real.reduce((s, c) => s + c.users, 0),
    byPlan: PLANS.map((p) => {
      const inPlan = real.filter((c) => planByKey(c.plan).key === p.key);
      return { key: p.key, name: p.name, companies: inPlan.length, mrr: inPlan.reduce((s, c) => s + c.mrr, 0) };
    }),
    byStatus,
    overdueInvoices: real.reduce((s, c) => s + c.overdueInvoices, 0),
    attention: real.filter((c) => c.attention.length > 0).sort((a, b) => b.attention.length - a.attention.length || b.mrr - a.mrr).slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Detail firmy
// ---------------------------------------------------------------------------

export interface CompanyBilling {
  billing_name: string | null;
  billing_ico: string | null;
  billing_dic: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
  billing_email: string | null;
  payment_method: string | null;
}

export interface InvoiceRow {
  id: string;
  company_id: string;
  number: string;
  issue_date: string;
  due_at: string | null;
  paid_at: string | null;
  amount: number;
  vat: number;
  currency: string;
  status: "issued" | "paid" | "void";
  file_url: string | null;
  created_at: string;
}

export interface NoteRow {
  id: string;
  author_label: string | null;
  body: string;
  created_at: string;
}

export interface CompanyDetail {
  company: CompanyListItem;
  billing: CompanyBilling | null;
  admins: { name: string; email: string | null; active: boolean }[];
  usersTotal: number;
  usersInactive: number;
  invoices: InvoiceRow[];
  notes: NoteRow[];
  activity: { id: string; created_at: string; action: string; result: string; actor_label: string | null; details: Record<string, unknown> }[];
}

export const INVOICE_COLUMNS = "id, company_id, number, issue_date, due_at, paid_at, amount, vat, currency, status, file_url, created_at";

export async function loadCompany(id: string, opts: { full: boolean }): Promise<CompanyDetail | null> {
  const db = platformDb();
  const { data: row } = await db.from("companies").select(COMPANY_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return null;
  const today = todayIso();
  const [billing, profiles, invoices, notes, activity] = await Promise.all([
    db.from("company_billing").select("billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip, billing_email, payment_method").eq("company_id", id).maybeSingle(),
    // Jen počty a správci firmy — data o absencích super-admin ve fázi 1 nečte vůbec.
    opts.full ? db.from("profiles").select("name, email, role, active, is_demo").eq("company_id", id).eq("is_demo", false) : Promise.resolve({ data: [] as { name: string; email: string | null; role: string; active: boolean }[] }),
    db.from("company_invoices").select(INVOICE_COLUMNS).eq("company_id", id).order("issue_date", { ascending: false }).order("number", { ascending: false }),
    opts.full ? db.from("platform_company_notes").select("id, author_label, body, created_at").eq("company_id", id).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as NoteRow[] }),
    opts.full ? db.from("platform_audit_log").select("id, created_at, action, result, actor_label, details").eq("company_id", id).order("created_at", { ascending: false }).limit(15) : Promise.resolve({ data: [] as CompanyDetail["activity"] }),
  ]);
  const people = (profiles.data ?? []) as { name: string; email: string | null; role: string; active: boolean }[];
  const invs = (invoices.data ?? []) as InvoiceRow[];
  const activeUsers = opts.full ? people.filter((p) => p.active).length : (await activeUserCounts()).get(id) ?? 0;
  const c = row as CompanyRow;
  const priceRows = await loadPriceRows().catch(() => []);
  const overdue = invs.filter((i) => isOverdue(i, today)).length;
  const item: CompanyListItem = {
    ...c,
    discount_pct: Number(c.discount_pct ?? 0),
    status: c.status ?? "active",
    users: activeUsers,
    mrr: monthlyRevenue({ plan: c.plan, addons: c.addons, billingPeriod: c.billing_period, users: activeUsers, discountPct: Number(c.discount_pct ?? 0), priceOverride: priceOf(c, new Map(priceRows.map((r) => [r.id, r])), currentRows(priceRows, today)) }),
    overdueInvoices: overdue,
    attention: attentionFor(c, activeUsers, overdue, today),
  };
  return {
    company: item,
    billing: (billing.data as CompanyBilling | null) ?? null,
    admins: people.filter((p) => p.role === "admin").map((p) => ({ name: p.name, email: p.email, active: p.active })),
    usersTotal: people.length,
    usersInactive: people.filter((p) => !p.active).length,
    invoices: invs.map((i) => ({ ...i, amount: Number(i.amount), vat: Number(i.vat ?? 0) })),
    notes: (notes.data ?? []) as NoteRow[],
    activity: (activity.data ?? []) as CompanyDetail["activity"],
  };
}

export const companyLabel = (c: { name: string; seq_id: number }) => `${c.name} (#${c.seq_id})`;
