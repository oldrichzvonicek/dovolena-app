"use client";

import { useState } from "react";
import { Container } from "./Container";
import { CheckIcon } from "./icons";
import { ADDONS, getPlanPricing, type BillingPeriod, type PlanId } from "@/lib/dodio-pricing";

// Each tier's feature list is cumulative — Starter includes everything Free
// has plus its own additions, and so on up to Pro. Matches how the tiers
// are actually scoped: nothing is ever removed going up, only added. Shown
// on the card as "Vše z <nižší tarif>, plus:" instead of repeating every
// earlier item, so the checklist stays short at every tier.
const FREE_FEATURES = [
  "Žádosti a zůstatky pro každého",
  "Schvalování na webu i z e-mailu",
  "Týmový kalendář",
  "Notifikace v Dodiu a e-mailem",
  "Analytika a přehled kapacity",
  "Chytré návrhy dovolené",
  "Role HR zdarma na jakémkoli tarifu",
  "GDPR ready",
];

const STARTER_ADDS = ["Exporty pro mzdy (CSV, Excel)", "iCal synchronizace kalendáře", "Doplňková role Účetní"];

const TEAM_ADDS = ["Historie změn (audit log)", "Nárok podle odpracovaných let"];

const PRO_ADDS = ["Smart HR — predikce kapacity a trendy", "Eskalace schvalování a zástupy", "Bez limitu uživatelů"];

const PLAN_OWN_FEATURES: Record<PlanId, string[]> = {
  free: FREE_FEATURES,
  starter: STARTER_ADDS,
  team: TEAM_ADDS,
  pro: PRO_ADDS,
};

const PLAN_INHERITS_FROM: Record<PlanId, string | null> = {
  free: null,
  starter: "Free",
  team: "Starter",
  pro: "Team",
};

export function Pricing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const plans = getPlanPricing(period);

  return (
    <section
      id="cenik"
      className="scroll-mt-16 border-y border-dodio-border bg-dodio-surface-card font-dodio-sans lg:scroll-mt-24"
    >
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex flex-col items-start gap-3.5 lg:items-center lg:gap-3.5 lg:text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Ceník
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Do 5 lidí napořád zdarma.
          </h2>
          <p className="m-0 max-w-[600px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
            Žádná zkušební lhůta, která vyprší — tarif Free zůstává zdarma, dokud tým neporoste. Bez platební
            karty. Při roční platbě máte 2 měsíce zdarma.
          </p>
        </div>

        <div className="flex lg:justify-center">
          <div className="flex gap-1 rounded-xl bg-[#F0EDE6] p-1">
            <button
              type="button"
              aria-pressed={period === "monthly"}
              onClick={() => setPeriod("monthly")}
              className={`h-11 rounded-dodio-md px-[18px] text-[15px] font-semibold lg:px-[22px] ${
                period === "monthly" ? "bg-white text-dodio-ink shadow-[0_1px_3px_rgba(44,44,42,0.15)]" : "text-dodio-ink-muted"
              }`}
            >
              Měsíčně
            </button>
            <button
              type="button"
              aria-pressed={period === "yearly"}
              onClick={() => setPeriod("yearly")}
              className={`flex h-11 items-center gap-1.5 rounded-dodio-md px-[18px] text-[15px] font-semibold lg:gap-2 ${
                period === "yearly" ? "bg-white text-dodio-ink shadow-[0_1px_3px_rgba(44,44,42,0.15)]" : "text-dodio-ink-muted"
              }`}
            >
              Ročně{" "}
              <span className="rounded-dodio-sm bg-[#FBE4DA] px-2 py-0.5 text-[11px] font-bold text-dodio-coral-dark lg:text-xs">
                <span className="lg:hidden">2 měs. zdarma</span>
                <span className="hidden lg:inline">2 měsíce zdarma</span>
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-4 lg:gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col gap-4 rounded-dodio-lg p-6 lg:gap-4 lg:p-7 ${
                plan.recommended
                  ? "border-2 border-dodio-teal bg-white shadow-[0_24px_48px_-28px_rgba(8,80,65,0.45)] lg:gap-4"
                  : plan.id === "free"
                    ? "border-2 border-dodio-teal-dark bg-white"
                    : "border border-dodio-border bg-dodio-surface"
              }`}
            >
              {plan.id === "free" && (
                <div className="-mx-6 -mt-6 rounded-t-[14px] bg-dodio-teal-dark px-6 py-2 text-center text-xs font-semibold text-white lg:-mx-7 lg:-mt-7">
                  Pro malé týmy navždy zdarma
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="font-dodio-display text-xl font-bold lg:text-[22px]">{plan.name}</div>
                {plan.recommended && (
                  <span className="rounded-dodio-sm bg-[#E3F2EC] px-2.5 py-1 text-xs font-semibold text-dodio-teal-dark">
                    Doporučujeme
                  </span>
                )}
              </div>
              <div className="text-sm text-dodio-ink-muted lg:text-[15px]">
                {plan.forWhom} · {plan.usersLabel}
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-dodio-display text-[26px] font-extrabold tracking-[-1px] lg:text-[38px]">
                  {plan.price}
                </span>
                {plan.perUnit && <span className="text-sm text-dodio-ink-muted">{plan.perUnit}</span>}
              </div>
              <div className="min-h-[40px] text-[13px] leading-5 text-dodio-ink-muted lg:text-sm">
                {plan.note}
              </div>
              <div className="flex flex-col gap-2 border-t border-dodio-border pt-4 text-[13px] leading-5 lg:text-sm">
                {PLAN_INHERITS_FROM[plan.id] && (
                  <div className="pb-1 font-semibold text-dodio-ink">
                    Vše z tarifu {PLAN_INHERITS_FROM[plan.id]}, plus:
                  </div>
                )}
                {PLAN_OWN_FEATURES[plan.id].map((label) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <CheckIcon />
                    <span className="text-dodio-ink">{label}</span>
                  </div>
                ))}
              </div>
              <a
                href={plan.ctaHref}
                className="mt-auto rounded-dodio-md bg-dodio-teal-dark py-3.5 text-center text-base font-semibold text-white no-underline hover:bg-dodio-teal"
              >
                {plan.ctaLabel}
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:p-8">
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
              Doplňky k dokoupení pro nižší tarify
            </div>
            <div className="text-sm text-dodio-ink-muted">
              Smart HR a role Účetní nejsou jen ve vyšších tarifech — dokoupíte je samostatně, i když je
              ještě nepotřebujete jako celý balíček.
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {ADDONS.map((addon) => (
              <div
                key={addon.name}
                className="rounded-dodio-md border border-dodio-border bg-dodio-surface px-4 py-3"
              >
                <div className="text-sm font-semibold text-dodio-ink">
                  {addon.name} <span className="font-normal text-dodio-ink-muted">— {addon.monthlyPrice} Kč / měs.</span>
                </div>
                <div className="text-xs text-dodio-ink-muted">{addon.note}</div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
