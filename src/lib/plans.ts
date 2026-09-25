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
  /** Jednou větou: pro koho je tarif. */
  tagline: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    employeeLimit: 5,
    monthly: 0,
    yearly: 0,
    tagline: "Pro úplné začátky: dovolená pod kontrolou bez tabulek.",
    features: ["Až 5 uživatelů", "Žádosti, schvalování a týmový kalendář", "Notifikace v aplikaci a e-mailová upozornění", "Chytré návrhy dovolené"],
  },
  {
    key: "basic",
    name: "Starter",
    employeeLimit: 10,
    monthly: 290,
    yearly: 2900,
    tagline: "Malý tým, který potřebuje podklady pro mzdy a kalendář v mobilu.",
    features: ["Až 10 uživatelů", "Vše z tarifu Free", "iCal a CSV export", "Role Účetní a mzdový export"],
  },
  {
    key: "starter",
    name: "Team",
    employeeLimit: 15,
    monthly: 590,
    yearly: 5900,
    tagline: "Rostoucí firma, kde se žádosti a upozornění řeší přímo v Teams nebo Slacku.",
    features: ["Až 15 uživatelů", "Vše z tarifu Starter", "Integrace do firemních nástrojů (Teams, Slack, Discord a další)"],
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
    tagline: "Firma, která lidi opravdu řídí: přehledy, pravidla a žádné limity.",
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
    availableOn: ["free"],
    includedIn: ["basic", "starter", "pro"],
    info: "Role Účetní (jen čtení) a mzdové exporty: účetní stahuje podklady pro mzdy, ale nevidí typy citlivých absencí. Od tarifu Starter je v ceně.",
  },
];

export const addonByKey = (key: AddonKey): Addon => ADDONS.find((a) => a.key === key)!;

/** Má firma s daným tarifem a doplňky funkci? Stejné pravidlo je v SQL (company_has_feature). */
export function hasFeature(planKey: string | null | undefined, addons: readonly string[] | null | undefined, feature: AddonKey): boolean {
  return addonByKey(feature).includedIn.includes(planByKey(planKey).key) || (addons ?? []).includes(feature);
}

// ---------------------------------------------------------------------------
// Srovnávací tabulka funkcí (pořadí sloupců = pořadí tarifů: Free, Starter, Team, Pro)
// ---------------------------------------------------------------------------

/** true = v ceně, false = není, "addon" = přikoupit jako doplněk, text = konkrétní hodnota. */
export type Cell = boolean | "addon" | string;

export interface FeatureRow {
  label: string;
  /** Krátká věta, proč to zákazníkovi pomáhá (zobrazí se pod názvem). */
  benefit?: string;
  values: [Cell, Cell, Cell, Cell];
}

export interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

export const FEATURE_MATRIX: FeatureGroup[] = [
  {
    title: "Každodenní dovolená",
    rows: [
      { label: "Počet uživatelů", values: ["5", "10", "15", "bez limitu"] },
      { label: "Žádosti a schvalování", benefit: "Konec e-mailů a tabulek, každý vidí stav své žádosti.", values: [true, true, true, true] },
      { label: "Týmový kalendář a české svátky", benefit: "Na první pohled vidíte, kdo kdy chybí.", values: [true, true, true, true] },
      { label: "Soukromí nemoci", benefit: "Kolegové vidí jen „Nepřítomen“, důvod znají jen nadřízený a admin.", values: [true, true, true, true] },
      { label: "Chytré návrhy dovolené", benefit: "Kdy stačí pár dní k dlouhému volnu kolem svátků.", values: [true, true, true, true] },
      { label: "Notifikace v aplikaci a e-mailová upozornění", values: [true, true, true, true] },
    ],
  },
  {
    title: "Mzdy a účetnictví",
    rows: [
      { label: "iCal a CSV export", benefit: "Kalendář v telefonu a data do Excelu.", values: [false, true, true, true] },
      { label: "Role Účetní a mzdový export", benefit: "Účetní si podklady stáhne sama, bez psaní e-mailů.", values: ["addon", true, true, true] },
    ],
  },
  {
    title: "Propojení",
    rows: [
      { label: "Teams, Slack, Discord a další", benefit: "Nové žádosti a schválení se ukazují přímo ve firemním chatu.", values: [false, false, true, true] },
      { label: "Webhooky", benefit: "Napojení na vlastní systémy.", values: [false, false, false, true] },
    ],
  },
  {
    title: "Řízení a přehledy",
    rows: [
      { label: "Eskalace schvalování a zástupy", benefit: "Žádost nezůstane viset, když je schvalovatel pryč.", values: [false, false, false, true] },
      { label: "Nárok podle odpracovaných let", benefit: "Automatický nárok podle délky zaměstnání a poměrná dovolená pro nováčky.", values: [false, false, false, true] },
      { label: "Analytika a Historie změn", values: [false, false, false, true] },
      { label: "HR Insights a role HR", benefit: "Předpověď kapacity, trendy, dobití baterií a férové plánování.", values: ["addon", "addon", "addon", true] },
    ],
  },
];

/** Cena na osobu a měsíc při plném využití limitu tarifu (jen tarify s pevným limitem). */
export function pricePerUser(plan: Plan): number | null {
  return plan.employeeLimit && plan.monthly > 0 ? Math.round(plan.monthly / plan.employeeLimit) : null;
}
