import { ADDONS, PLAN_ORDER } from "@/lib/plans";
import { changeKind, downgradeEffectiveDate, type ChangeKind } from "@/lib/plan-change";

/**
 * Změna předplatného firmy provozovatelem. Pravidla jsou stejná jako v docs/PODMINKY_TARIFY.md:
 *  - zvýšení tarifu platí hned,
 *  - snížení platí až den po `plan_paid_until` (naplánuje se jako pending_plan; vyřídí ho denní úloha aplikace),
 *    provozovatel ho může výjimečně použít hned (`immediate`).
 */

export interface SubscriptionState {
  plan: string;
  addons: string[] | null;
  billing_period: string;
  plan_paid_until: string | null;
  pending_plan: string | null;
  pending_plan_from: string | null;
  discount_pct: number;
}

export interface SubscriptionRequest {
  plan?: unknown;
  addons?: unknown;
  billing_period?: unknown;
  /** undefined = beze změny, null = smazat platnost. */
  plan_paid_until?: unknown;
  discount_pct?: unknown;
  immediate?: unknown;
  cancel_pending?: unknown;
}

export interface SubscriptionPlan {
  /** Sloupce companies, které se mají zapsat. */
  update: Record<string, unknown>;
  /** Před a po pro změněné položky (do auditu). */
  changes: Record<string, { from: unknown; to: unknown }>;
  kind: ChangeKind;
  /** Snížení tarifu naplánované na později. */
  scheduled: boolean;
  scheduledFrom: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;

export function planSubscriptionChange(current: SubscriptionState, req: SubscriptionRequest, today: string): SubscriptionPlan | { error: string } {
  const currentPlan = current.plan === "enterprise" ? "pro" : current.plan;
  const target = req.plan === undefined ? currentPlan : req.plan;
  if (typeof target !== "string" || !(PLAN_ORDER as string[]).includes(target)) return { error: "Neznámý tarif." };

  let addons = current.addons ?? [];
  if (req.addons !== undefined) {
    if (!Array.isArray(req.addons) || req.addons.some((a) => !ADDONS.some((x) => x.key === a))) return { error: "Neznámý doplněk." };
    addons = Array.from(new Set(req.addons as string[]));
  }

  let period = current.billing_period;
  if (req.billing_period !== undefined) {
    if (req.billing_period !== "monthly" && req.billing_period !== "yearly") return { error: "Období musí být měsíční nebo roční." };
    period = req.billing_period;
  }

  let paidUntil = current.plan_paid_until;
  if (req.plan_paid_until !== undefined) {
    if (req.plan_paid_until === null || req.plan_paid_until === "") paidUntil = null;
    else if (typeof req.plan_paid_until === "string" && isRealDate(req.plan_paid_until)) paidUntil = req.plan_paid_until;
    else return { error: "Platnost tarifu musí být platné datum." };
  }

  let discount = Number(current.discount_pct ?? 0);
  if (req.discount_pct !== undefined) {
    const d = Number(req.discount_pct);
    if (!Number.isFinite(d) || d < 0 || d > 100) return { error: "Sleva musí být mezi 0 a 100 %." };
    discount = Math.round(d * 10) / 10;
  }

  const kind = changeKind(currentPlan, target);
  const wantImmediate = req.immediate === true;
  const scheduleDowngrade = kind === "downgrade" && !wantImmediate && !!paidUntil;
  const cancelPending = req.cancel_pending === true;

  const update: Record<string, unknown> = { addons, billing_period: period, plan_paid_until: paidUntil, discount_pct: discount };
  let scheduledFrom: string | null = null;
  if (scheduleDowngrade) {
    scheduledFrom = downgradeEffectiveDate(paidUntil, today);
    update.pending_plan = target;
    update.pending_plan_from = scheduledFrom;
    update.pending_plan_notified = false;
    update.plan = currentPlan;
  } else {
    update.plan = target;
    // Provedená změna (nebo zrušení) vždy zruší dříve naplánované snížení.
    if (current.pending_plan || cancelPending || kind !== "same") {
      update.pending_plan = null;
      update.pending_plan_from = null;
      update.pending_plan_notified = false;
    }
  }
  if (kind === "same" && cancelPending) {
    update.pending_plan = null;
    update.pending_plan_from = null;
    update.pending_plan_notified = false;
  }

  const before: Record<string, unknown> = {
    plan: currentPlan,
    addons: current.addons ?? [],
    billing_period: current.billing_period,
    plan_paid_until: current.plan_paid_until,
    discount_pct: Number(current.discount_pct ?? 0),
    pending_plan: current.pending_plan,
    pending_plan_from: current.pending_plan_from,
  };
  const changes: SubscriptionPlan["changes"] = {};
  for (const [k, v] of Object.entries(update)) {
    if (!(k in before)) continue;
    const a = JSON.stringify(before[k] ?? null);
    const b = JSON.stringify(v ?? null);
    if (a !== b) changes[k] = { from: before[k] ?? null, to: v ?? null };
  }
  return { update, changes, kind, scheduled: scheduleDowngrade, scheduledFrom };
}
