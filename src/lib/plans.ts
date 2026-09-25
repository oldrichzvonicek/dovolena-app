// Tariffs and prices (CZK, bez DPH nebylo upřesněno). Edit here to change what the app shows.
// Zatím se limity jen zobrazují, nevynucují.

export type PlanKey = "free" | "starter" | "pro" | "enterprise";

export interface Plan {
  key: PlanKey;
  name: string;
  /** Max users included; null = no fixed cap (extra users are billed). */
  employeeLimit: number | null;
  /** Fixed price per month / per year. */
  monthly: number;
  yearly: number;
  /** Enterprise: price per additional user above `includedUsers`. */
  extraPerUserMonthly?: number;
  extraPerUserYearly?: number;
  includedUsers?: number;
  recommended?: boolean;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    employeeLimit: 5,
    monthly: 0,
    yearly: 0,
    features: ["Až 5 uživatelů", "Žádosti, schvalování a týmový kalendář", "Notifikace v aplikaci"],
  },
  {
    key: "starter",
    name: "Starter",
    employeeLimit: 15,
    monthly: 590,
    yearly: 5900,
    features: ["Až 15 uživatelů", "Vše z tarifu Free", "E-mailová upozornění", "iCal export"],
  },
  {
    key: "pro",
    name: "Pro",
    employeeLimit: 30,
    monthly: 1190,
    yearly: 11900,
    recommended: true,
    features: ["Až 30 uživatelů", "Vše z tarifu Starter", "Analytika a Smart HR Insights", "Eskalace schvalování a zástupy", "Historie změn"],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    employeeLimit: null,
    includedUsers: 30,
    monthly: 1190,
    yearly: 11900,
    extraPerUserMonthly: 39,
    extraPerUserYearly: 390,
    features: ["Nad 30 uživatelů", "Vše z tarifu Pro", "Základ jako Pro + doplatek za každého dalšího uživatele"],
  },
];

export const YEARLY_NOTE = "2 měsíce zdarma";

/** Legacy value from the first version of the column. */
export const planByKey = (key: string | null | undefined): Plan => PLANS.find((p) => p.key === key) ?? PLANS[0];

export const formatKc = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;

/** Price of a plan for a given user count and billing period. */
export function planPrice(plan: Plan, users: number, period: "monthly" | "yearly"): number {
  const base = period === "monthly" ? plan.monthly : plan.yearly;
  if (plan.key !== "enterprise" || !plan.includedUsers) return base;
  const extra = Math.max(0, users - plan.includedUsers);
  return base + extra * ((period === "monthly" ? plan.extraPerUserMonthly : plan.extraPerUserYearly) ?? 0);
}

/** Cheapest plan that fits the given number of users. */
export function recommendedFor(users: number): Plan {
  return PLANS.find((p) => p.employeeLimit === null || users <= p.employeeLimit) ?? PLANS[PLANS.length - 1];
}
