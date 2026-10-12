import { addMonths, addYears, format } from "date-fns";
import { ADDONS, planByKey, planPrice, type AddonKey, type Plan } from "@/lib/plans";
import { addDaysIso, type BillingPeriod } from "@/lib/plan-change";

/** Dnešní datum v českém čase (Vercel běží v UTC, „dnes“ by jinak chvíli po půlnoci bylo včera). */
export const todayIso = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });

export interface RevenueInput {
  plan: string | null | undefined;
  addons: readonly string[] | null | undefined;
  billingPeriod: string | null | undefined;
  /** Aktivní uživatelé bez ukázkových účtů. */
  users: number;
  discountPct?: number | null;
  /** Ceny z tabulky plans (aktuální nebo zamčené řádky firmy); bez nich platí ceny z src/lib/plans.ts. */
  priceOverride?: Partial<Plan>;
}

/**
 * Měsíční příjem z firmy v Kč (MRR): cena tarifu pro daný počet uživatelů + doplňky, které tarif nemá v ceně; roční platba
 * se dělí dvanácti; sleva se počítá z celku. Ceny bere ze src/lib/plans.ts, tedy stejné jako aplikace.
 */
export function monthlyRevenue(input: RevenueInput): number {
  const plan: Plan = { ...planByKey(input.plan), ...(input.priceOverride ?? {}) };
  const period: BillingPeriod = input.billingPeriod === "yearly" ? "yearly" : "monthly";
  let total = planPrice(plan, input.users, period);
  for (const addon of ADDONS) {
    if (!(input.addons ?? []).includes(addon.key as AddonKey)) continue;
    if (addon.includedIn.includes(plan.key)) continue;
    total += period === "yearly" ? addon.yearly : addon.monthly;
  }
  const monthly = period === "yearly" ? total / 12 : total;
  const discount = Math.min(100, Math.max(0, input.discountPct ?? 0));
  return Math.round(monthly * (1 - discount / 100));
}

/**
 * Nová platnost tarifu po zaplacení jednoho období. plan_paid_until je POSLEDNÍ zaplacený den: když platnost ještě trvá,
 * nové období navazuje den po ní, jinak začíná dnes. Měsíční období = +1 měsíc, roční = +1 rok, vždy minus jeden den.
 */
export function extendPaidUntil(paidUntil: string | null | undefined, today: string, period: BillingPeriod): string {
  const start = paidUntil && paidUntil >= today ? addDaysIso(paidUntil, 1) : today;
  const d = new Date(`${start}T12:00:00`);
  const end = period === "yearly" ? addYears(d, 1) : addMonths(d, 1);
  return addDaysIso(format(end, "yyyy-MM-dd"), -1);
}

/** Další číslo faktury ve tvaru ROK + čtyřmístné pořadí (2026 + 0007 → 20260007); ostatní tvary čísel se ignorují. */
export function nextInvoiceNumber(existing: readonly string[], year: number): string {
  const prefix = String(year);
  let max = 0;
  for (const n of existing) {
    const m = /^(\d{4})(\d{4})$/.exec(n.trim());
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Faktura je po splatnosti, když je vystavená (ne zaplacená ani storno) a splatnost je v minulosti. */
export function isOverdue(inv: { status: string; due_at: string | null }, today: string): boolean {
  return inv.status === "issued" && !!inv.due_at && inv.due_at < today;
}

export const formatKcCz = (n: number) => `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
export const formatCzDate = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("cs-CZ") : "–");
