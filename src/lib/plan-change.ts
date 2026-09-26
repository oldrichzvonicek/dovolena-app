import { planByKey, planPrice, planRank, type Plan } from "@/lib/plans";

/**
 * Změna tarifu v průběhu zaplaceného období — pravidla (viz docs/PODMINKY_TARIFY.md):
 *  - ZVÝŠENÍ platí hned; nevyužitá část starého tarifu se započítá jako kredit, výročí (obnova) zůstává.
 *  - SNÍŽENÍ platí až od konce zaplaceného období, peníze se nevrací.
 * Částky jsou orientační; závazná je faktura / dobropis.
 */

export type BillingPeriod = "monthly" | "yearly";

const DAY = 86_400_000;
const dayNumber = (iso: string) => Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / DAY);

export const addDaysIso = (iso: string, n: number) => new Date((dayNumber(iso) + n) * DAY + DAY / 2).toISOString().slice(0, 10);

/** Kolik dní zaplaceného období zbývá (včetně dne `paidUntil` i dnešního dne); 0, když už skončilo. */
export function remainingDays(paidUntil: string | null | undefined, today: string): number {
  if (!paidUntil) return 0;
  return Math.max(0, dayNumber(paidUntil) - dayNumber(today) + 1);
}

export interface UpgradeQuote {
  remainingDays: number;
  periodDays: number;
  /** Nevyužitá část zaplaceného starého tarifu. */
  credit: number;
  /** Cena nového tarifu za zbývající dobu. */
  newCost: number;
  /** Orientační doplatek. */
  toPay: number;
}

/** Orientační doplatek při zvýšení tarifu uprostřed zaplaceného období (poměrně podle dnů, zaokrouhleno na celé Kč). */
export function quoteUpgrade(opts: { from: Plan; to: Plan; users: number; period: BillingPeriod; paidUntil: string | null | undefined; today: string }): UpgradeQuote | null {
  const remaining = remainingDays(opts.paidUntil, opts.today);
  if (remaining === 0) return null;
  const periodDays = opts.period === "yearly" ? 365 : 30;
  const fraction = Math.min(1, remaining / periodDays);
  const credit = Math.round(planPrice(opts.from, opts.users, opts.period) * fraction);
  const newCost = Math.round(planPrice(opts.to, opts.users, opts.period) * fraction);
  return { remainingDays: remaining, periodDays, credit, newCost, toPay: Math.max(0, newCost - credit) };
}

export type ChangeKind = "upgrade" | "downgrade" | "same";

export function changeKind(fromKey: string | null | undefined, toKey: string | null | undefined): ChangeKind {
  const a = planRank(fromKey);
  const b = planRank(toKey);
  return b > a ? "upgrade" : b < a ? "downgrade" : "same";
}

/** Kdy se po snížení tarifu změna projeví: den po posledním zaplaceném dni (nebo dnes, když platnost už skončila). */
export function downgradeEffectiveDate(paidUntil: string | null | undefined, today: string): string | null {
  if (!paidUntil) return null;
  return addDaysIso(paidUntil >= today ? paidUntil : today, 1);
}

/** Kolik aktivních lidí přesahuje limit nového tarifu (0 = vejdou se). */
export function overLimitBy(targetKey: string, activeUsers: number): number {
  const limit = planByKey(targetKey).employeeLimit;
  return limit === null ? 0 : Math.max(0, activeUsers - limit);
}
