// Single source of truth for dodio.cz pricing. Changing a price here is the
// only thing a price change should ever require — no component should hold
// a number of its own. Yearly billing is 10× the monthly price (2 months
// free); everything derived below follows from that rule.

export type BillingPeriod = "monthly" | "yearly";

export type PlanId = "free" | "starter" | "pro" | "enterprise";

interface PlanDefinition {
  id: PlanId;
  name: string;
  usersLabel: string;
  monthlyPrice: number | null; // null = "0 Kč", still shown explicitly
  /** Per-extra-user monthly surcharge above the plan's user cap (Enterprise only). */
  extraUserMonthlyPrice?: number;
  /** User cap used only for the Enterprise FAQ/example calculation. */
  exampleUserCount?: number;
  recommended?: boolean;
}

const YEARLY_MONTHS = 10;

const PLAN_DEFINITIONS: PlanDefinition[] = [
  { id: "free", name: "Free", usersLabel: "do 5", monthlyPrice: 0 },
  { id: "starter", name: "Starter", usersLabel: "do 15", monthlyPrice: 590 },
  { id: "pro", name: "Pro", usersLabel: "do 30", monthlyPrice: 1190, recommended: true },
  {
    id: "enterprise",
    name: "Enterprise",
    usersLabel: "nad 30",
    monthlyPrice: 1190,
    extraUserMonthlyPrice: 39,
    exampleUserCount: 50,
  },
];

/** Formats an integer amount the Czech way: space as thousands separator, "Kč" suffix. */
export function formatKc(amount: number): string {
  const rounded = Math.round(amount);
  const withSpaces = rounded.toLocaleString("cs-CZ").replace(/ /g, " ");
  return `${withSpaces} Kč`;
}

function priceForPeriod(monthly: number, period: BillingPeriod): number {
  return period === "yearly" ? monthly * YEARLY_MONTHS : monthly;
}

function savingsLabel(monthly: number): string {
  const yearlyTotal = monthly * YEARLY_MONTHS;
  const fullPrice = monthly * 12;
  const savings = fullPrice - yearlyTotal;
  return `Platíte 10 měsíců místo 12 – ušetříte ${formatKc(savings)}.`;
}

export interface PlanPricing {
  id: PlanId;
  name: string;
  usersLabel: string;
  recommended: boolean;
  price: string;
  perUnit: "/ měs." | "/ rok" | "";
  note: string;
  extraUserPrice?: string;
  exampleLine?: string;
  ctaLabel: string;
  ctaHref: string;
}

const CTA_LABEL: Record<PlanId, string> = {
  free: "Začít zdarma",
  starter: "Vybrat Starter",
  pro: "Vybrat Pro",
  enterprise: "Vybrat Enterprise",
};

/** Registration URL to fill in once the app's sign-up flow is live. */
const SIGNUP_URL = "[URL REGISTRACE]";

export function getPlanPricing(period: BillingPeriod): PlanPricing[] {
  return PLAN_DEFINITIONS.map((plan) => {
    const monthly = plan.monthlyPrice ?? 0;

    if (plan.id === "free") {
      return {
        id: plan.id,
        name: plan.name,
        usersLabel: plan.usersLabel,
        recommended: false,
        price: "0 Kč",
        perUnit: "",
        note: "Pro mikrofirmy a startupy. Bez exportů pro mzdy a Slacku/Teams.",
        ctaLabel: CTA_LABEL[plan.id],
        ctaHref: `${SIGNUP_URL}?plan=free`,
      };
    }

    const price = formatKc(priceForPeriod(monthly, period));
    const perUnit = period === "yearly" ? "/ rok" : "/ měs.";

    if (plan.id === "enterprise") {
      const extraMonthly = plan.extraUserMonthlyPrice ?? 0;
      const extraPrice = formatKc(priceForPeriod(extraMonthly, period));
      const exampleUsers = plan.exampleUserCount ?? 50;
      const exampleOverage = exampleUsers - 30;
      const exampleTotal = priceForPeriod(monthly, period) + exampleOverage * priceForPeriod(extraMonthly, period);
      return {
        id: plan.id,
        name: plan.name,
        usersLabel: plan.usersLabel,
        recommended: false,
        price,
        perUnit,
        note: "",
        extraUserPrice: `${extraPrice} ${perUnit}`,
        exampleLine: `Např. ${exampleUsers} lidí = ${formatKc(exampleTotal)} ${perUnit}`,
        ctaLabel: CTA_LABEL[plan.id],
        ctaHref: `${SIGNUP_URL}?plan=enterprise&billing=${period}`,
      };
    }

    const note =
      period === "yearly"
        ? savingsLabel(monthly)
        : `Ročně jen ${formatKc(monthly * YEARLY_MONTHS)} – 2 měsíce zdarma.`;

    return {
      id: plan.id,
      name: plan.name,
      usersLabel: plan.usersLabel,
      recommended: Boolean(plan.recommended),
      price,
      perUnit,
      note,
      ctaLabel: CTA_LABEL[plan.id],
      ctaHref: `${SIGNUP_URL}?plan=${plan.id}&billing=${period}`,
    };
  });
}

/** Used by the Enterprise FAQ answer so its numbers can never drift from the pricing table. */
export function enterpriseFaqAnswer(): string {
  const base = PLAN_DEFINITIONS.find((p) => p.id === "enterprise")!;
  const monthly = formatKc(base.monthlyPrice ?? 0);
  const extra = formatKc(base.extraUserMonthlyPrice ?? 0);
  return `Tarif Enterprise plynule navazuje na Pro: ${monthly} měsíčně a ${extra} za každého uživatele nad 30. Při roční platbě máte 2 měsíce zdarma.`;
}
