"use client";

import { useState } from "react";
import { Container } from "./Container";
import { CheckIcon } from "./icons";
import { getPlanPricing, type BillingPeriod, type PlanId } from "@/lib/dodio-pricing";

const INCLUDED = [
  "Žádosti a zůstatky pro každého",
  "Týmový kalendář",
  "Centrum schvalování",
  "České svátky a typy absencí",
  "Exporty pro mzdy (od tarifu Starter)",
  "Synchronizace s kalendářem (iCal)",
];

// Every tier's own feature checklist. Starter/Pro/Enterprise all get the
// same set — Free is the only one missing payroll exports and the
// Slack/Teams add-on (per its card note: "Bez exportů pro mzdy a
// Slacku/Teams").
const BASE_FEATURES = [
  "Žádosti a zůstatky pro každého",
  "Týmový kalendář",
  "Centrum schvalování",
  "České svátky a typy absencí",
  "Synchronizace s kalendářem (iCal)",
  "GDPR ready",
];

const PLAN_FEATURES: Record<PlanId, Array<{ label: string; included: boolean }>> = {
  free: [
    ...BASE_FEATURES.map((label) => ({ label, included: true })),
    { label: "Exporty pro mzdy", included: false },
    { label: "Slack a Teams", included: false },
  ],
  starter: [
    ...BASE_FEATURES.map((label) => ({ label, included: true })),
    { label: "Exporty pro mzdy (CSV, XLSX, PDF)", included: true },
    { label: "Slack a Teams (placený doplněk)", included: true },
  ],
  pro: [
    ...BASE_FEATURES.map((label) => ({ label, included: true })),
    { label: "Exporty pro mzdy (CSV, XLSX, PDF)", included: true },
    { label: "Slack a Teams (placený doplněk)", included: true },
  ],
  enterprise: [
    ...BASE_FEATURES.map((label) => ({ label, included: true })),
    { label: "Exporty pro mzdy (CSV, XLSX, PDF)", included: true },
    { label: "Slack a Teams (placený doplněk)", included: true },
  ],
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
            Paušál podle velikosti týmu.
          </h2>
          <p className="m-0 max-w-[600px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
            Do 5 uživatelů zdarma, při roční platbě máte 2 měsíce zdarma.
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
                  : "border border-dodio-border bg-dodio-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-dodio-display text-xl font-bold lg:text-[22px]">{plan.name}</div>
                {plan.recommended && (
                  <span className="rounded-dodio-sm bg-[#E3F2EC] px-2.5 py-1 text-xs font-semibold text-dodio-teal-dark">
                    Doporučujeme
                  </span>
                )}
              </div>
              <div className="text-sm text-dodio-ink-muted lg:text-[15px]">{plan.usersLabel} uživatelů</div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="font-dodio-display text-[26px] font-extrabold tracking-[-1px] lg:text-[38px]">
                  {plan.price}
                </span>
                {plan.perUnit && <span className="text-sm text-dodio-ink-muted">{plan.perUnit}</span>}
              </div>
              <div className="min-h-[40px] text-[13px] leading-5 text-dodio-ink-muted lg:text-sm">
                {plan.id === "enterprise" ? (
                  <>
                    <strong className="font-semibold text-dodio-ink">+ {plan.extraUserPrice}</strong> za
                    každého uživatele nad 30. {plan.exampleLine}
                  </>
                ) : (
                  plan.note
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-dodio-border pt-4 text-[13px] leading-5 lg:text-sm">
                {PLAN_FEATURES[plan.id].map((feature) => (
                  <div key={feature.label} className="flex items-center gap-2.5">
                    {feature.included ? (
                      <CheckIcon />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-dodio-ink-muted">
                        –
                      </span>
                    )}
                    <span className={feature.included ? "text-dodio-ink" : "text-dodio-ink-muted"}>
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href={plan.ctaHref}
                className={`mt-auto rounded-dodio-md py-3.5 text-center text-base font-semibold no-underline ${
                  plan.recommended
                    ? "bg-dodio-teal-dark text-white hover:bg-dodio-teal"
                    : "border border-dodio-border bg-white text-dodio-ink"
                }`}
              >
                {plan.ctaLabel}
              </a>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border p-6 lg:gap-4 lg:p-8">
          <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
            Všechny tarify obsahují
          </div>
          <div className="grid grid-cols-1 gap-2.5 text-[15px] leading-[22px] sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-3">
            {INCLUDED.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="text-sm text-dodio-ink-muted">
            Integrace se Slackem a Microsoft Teams jako doplněk za [CENA DOPLŇKU]. Ceny jsou uvedeny [s
            DPH / bez DPH].
          </div>
        </div>
      </Container>
    </section>
  );
}
