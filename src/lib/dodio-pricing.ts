// Single source of truth for dodio.cz pricing. Changing a price here is the
// only thing a price change should ever require — no component should hold
// a number of its own. Yearly billing is 10× the monthly price (2 months
// free); everything derived below follows from that rule.

import { SIGNUP_URL } from "./dodio-links";

export type BillingPeriod = "monthly" | "yearly";

export type PlanId = "free" | "starter" | "team" | "pro";

interface PlanDefinition {
  id: PlanId;
  name: string;
  usersLabel: string;
  monthlyPrice: number;
  forWhom: string;
  /** Per-extra-user monthly surcharge above the plan's user cap (Pro only — it has no cap otherwise). */
  extraUserMonthlyPrice?: number;
  /** User count used only for the Pro example calculation. */
  exampleUserCount?: number;
  recommended?: boolean;
}

const YEARLY_MONTHS = 10;

const PLAN_DEFINITIONS: PlanDefinition[] = [
  { id: "free", name: "Free", usersLabel: "do 5 uživatelů", monthlyPrice: 0, forWhom: "Úplný začátek" },
  {
    id: "starter",
    name: "Starter",
    usersLabel: "do 10 uživatelů",
    monthlyPrice: 290,
    forWhom: "Malý tým, podklady pro mzdy",
  },
  {
    id: "team",
    name: "Team",
    usersLabel: "do 15 uživatelů",
    monthlyPrice: 590,
    forWhom: "Rostoucí firma",
    recommended: true,
  },
  {
    id: "pro",
    name: "Pro",
    usersLabel: "bez limitu (30 v ceně, pak 39 Kč/měs. za dalšího)",
    monthlyPrice: 1190,
    forWhom: "Firma, která lidi opravdu řídí",
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
  forWhom: string;
  recommended: boolean;
  price: string;
  perUnit: "/ měs." | "/ rok" | "";
  note: string;
  ctaLabel: string;
  ctaHref: string;
}

const CTA_LABEL: Record<PlanId, string> = {
  free: "Založit účet zdarma",
  starter: "Vybrat Starter",
  team: "Vybrat Team",
  pro: "Vybrat Pro",
};

export function getPlanPricing(period: BillingPeriod): PlanPricing[] {
  return PLAN_DEFINITIONS.map((plan) => {
    const monthly = plan.monthlyPrice;

    if (plan.id === "free") {
      return {
        id: plan.id,
        name: plan.name,
        usersLabel: plan.usersLabel,
        forWhom: plan.forWhom,
        recommended: false,
        price: "0 Kč",
        perUnit: "",
        note: "Pro mikrofirmy a startupy. Bez exportů pro mzdy.",
        ctaLabel: CTA_LABEL[plan.id],
        ctaHref: `${SIGNUP_URL}?plan=free`,
      };
    }

    const price = formatKc(priceForPeriod(monthly, period));
    const perUnit = period === "yearly" ? "/ rok" : "/ měs.";

    if (plan.id === "pro") {
      const extraMonthly = plan.extraUserMonthlyPrice ?? 0;
      const exampleUsers = plan.exampleUserCount ?? 50;
      const exampleOverage = exampleUsers - 30;
      const exampleTotal = priceForPeriod(monthly, period) + exampleOverage * priceForPeriod(extraMonthly, period);
      const note =
        period === "yearly"
          ? `Např. ${exampleUsers} lidí = ${formatKc(exampleTotal)} ${perUnit}.`
          : `Ročně jen ${formatKc(monthly * YEARLY_MONTHS)} – 2 měsíce zdarma.`;
      return {
        id: plan.id,
        name: plan.name,
        usersLabel: plan.usersLabel,
        forWhom: plan.forWhom,
        recommended: false,
        price,
        perUnit,
        note,
        ctaLabel: CTA_LABEL[plan.id],
        ctaHref: `${SIGNUP_URL}?plan=pro&billing=${period}`,
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
      forWhom: plan.forWhom,
      recommended: Boolean(plan.recommended),
      price,
      perUnit,
      note,
      ctaLabel: CTA_LABEL[plan.id],
      ctaHref: `${SIGNUP_URL}?plan=${plan.id}&billing=${period}`,
    };
  });
}

/** Standalone add-ons purchasable on top of the lower tiers (Smart HR, Účetní). */
export const ADDONS = [
  { name: "Smart HR", monthlyPrice: 200, note: "predikce kapacity, trendy, rychlost schvalování" },
  { name: "Účetní", monthlyPrice: 100, note: "doplňková role jen pro čtení mzdových podkladů" },
];
