// Tariffs and prices (CZK, bez DPH nebylo upřesněno). Edit here to change what the app shows.
// Zatím se limity uživatelů jen zobrazují, nevynucují. Funkce doplňků (HR Insights, Účetní) se vynucují.

// Interní klíče zůstávají kvůli existujícím datům: "basic" se zobrazuje jako Starter, "starter" jako Team.
export type PlanKey = "free" | "basic" | "starter" | "pro";

export interface Plan {
  key: PlanKey;
  name: string;
  /** Max users included; null = no fixed cap (extra users are billed). */
  employeeLimit: number | null;
  /** Fixed price per month / per year. */
  monthly: number;
  yearly: number;
  /** Pro: price per additional user above `includedUsers`. */
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
    features: ["Až 5 uživatelů", "Žádosti, schvalování a týmový kalendář", "Notifikace v aplikaci a e-mailová upozornění", "Chytré návrhy dovolené"],
  },
  {
    key: "basic",
    name: "Starter",
    employeeLimit: 10,
    monthly: 290,
    yearly: 2900,
    features: ["Až 10 uživatelů", "Vše z tarifu Free", "iCal a CSV export"],
  },
  {
    key: "starter",
    name: "Team",
    employeeLimit: 15,
    monthly: 590,
    yearly: 5900,
    features: ["Až 15 uživatelů", "Vše z tarifu Starter", "Integrace do firemních nástrojů (Teams, Slack, Discord a další)", "Role Účetní a mzdový export"],
  },
  {
    key: "pro",
    name: "Pro",
    employeeLimit: null,
    includedUsers: 30,
    monthly: 1190,
    yearly: 11900,
    extraPerUserMonthly: 39,
    extraPerUserYearly: 390,
    recommended: true,
    features: [
      "Bez horního limitu uživatelů (do 30 v ceně, každý další 39 Kč)",
      "Vše z tarifu Team",
      "HR Insights a role HR",
      "Analytika",
      "Eskalace schvalování a zástupy",
      "Historie změn",
      "Nárok podle odpracovaných let",
      "Webhooky",
    ],
  },
];

export const YEARLY_NOTE = "2 měsíce zdarma";

/** Neznámé a zastaralé hodnoty sloupce: "start" → Free, dřívější tarif "enterprise" (Business) → Pro. */
export const planByKey = (key: string | null | undefined): Plan => PLANS.find((p) => p.key === (key === "enterprise" ? "pro" : key)) ?? PLANS[0];

export const formatKc = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;

/** Price of a plan for a given user count and billing period. */
export function planPrice(plan: Plan, users: number, period: "monthly" | "yearly"): number {
  const base = period === "monthly" ? plan.monthly : plan.yearly;
  if (!plan.includedUsers) return base;
  const extra = Math.max(0, users - plan.includedUsers);
  return base + extra * ((period === "monthly" ? plan.extraPerUserMonthly : plan.extraPerUserYearly) ?? 0);
}

/** Cheapest plan that fits the given number of users. */
export function recommendedFor(users: number): Plan {
  return PLANS.find((p) => p.employeeLimit === null || users <= p.employeeLimit) ?? PLANS[PLANS.length - 1];
}

// ---------------------------------------------------------------------------
// Doplňky (cena za firmu, ne za uživatele)
// ---------------------------------------------------------------------------

export type AddonKey = "hr_insights" | "accountant";

export interface Addon {
  key: AddonKey;
  name: string;
  monthly: number;
  yearly: number;
  /** Tarify, ke kterým si lze doplněk přikoupit. */
  availableOn: PlanKey[];
  /** Tarify, které ho mají v ceně. */
  includedIn: PlanKey[];
  /** Vysvětlení pro informační ikonku. */
  info: string;
}

export const ADDONS: Addon[] = [
  {
    key: "hr_insights",
    name: "HR Insights",
    monthly: 200,
    yearly: 2000,
    availableOn: ["free", "basic", "starter"],
    includedIn: ["pro"],
    info:
      "Přehledy pro HR a vedení: předpověď kapacity týmu na 13 týdnů, trendy za 12 měsíců, anonymní nemocnost po odděleních (od 5 lidí), rychlost schvalování, závazek z nevyčerpané dovolené, dobití baterií a férové plánování Vánoc a léta. Součástí je role HR. Nemoc se nikdy neukazuje po jménech.",
  },
  {
    key: "accountant",
    name: "Účetní",
    monthly: 100,
    yearly: 1000,
    availableOn: ["free", "basic"],
    includedIn: ["starter", "pro"],
    info: "Role Účetní (jen čtení) a mzdové exporty: účetní stahuje podklady pro mzdy, ale nevidí typy citlivých absencí. Od tarifu Team je v ceně.",
  },
];

export const addonByKey = (key: AddonKey): Addon => ADDONS.find((a) => a.key === key)!;

/** Má firma s daným tarifem a doplňky funkci? Stejné pravidlo je v SQL (company_has_feature). */
export function hasFeature(planKey: string | null | undefined, addons: readonly string[] | null | undefined, feature: AddonKey): boolean {
  return addonByKey(feature).includedIn.includes(planByKey(planKey).key) || (addons ?? []).includes(feature);
}
