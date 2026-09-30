"use client";

import { useMemo, useState } from "react";
import { SIGNUP_URL } from "@/lib/dodio-links";

type EntitlementOption = "4" | "5" | "custom";

function formatNumber(value: number): string {
  return value.toLocaleString("cs-CZ", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function VacationCalculator() {
  const [weeklyHours, setWeeklyHours] = useState(40);
  const [workedWeeks, setWorkedWeeks] = useState(52);
  const [entitlementOption, setEntitlementOption] = useState<EntitlementOption>("4");
  const [customWeeks, setCustomWeeks] = useState(5);

  const entitlementWeeks = entitlementOption === "custom" ? customWeeks : Number(entitlementOption);

  const { totalHours, totalDays } = useMemo(() => {
    const safeWeeklyHours = Math.max(0, weeklyHours);
    const safeWorkedWeeks = Math.min(52, Math.max(0, workedWeeks));
    const safeEntitlementWeeks = Math.max(0, entitlementWeeks);

    const hours = (safeWorkedWeeks / 52) * safeWeeklyHours * safeEntitlementWeeks;
    const dailyHours = safeWeeklyHours / 5;
    const days = dailyHours > 0 ? hours / dailyHours : 0;

    return { totalHours: hours, totalDays: days };
  }, [weeklyHours, workedWeeks, entitlementWeeks]);

  return (
    <div className="flex flex-col gap-6 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:p-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-dodio-ink">Týdenní pracovní úvazek (hodin)</span>
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={weeklyHours}
            onChange={(event) => setWeeklyHours(Number(event.target.value))}
            className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-dodio-ink">Odpracované týdny v roce</span>
          <input
            type="number"
            min={0}
            max={52}
            step={1}
            value={workedWeeks}
            onChange={(event) => setWorkedWeeks(Number(event.target.value))}
            className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-dodio-ink">Výměra dovolené</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "4", label: "4 týdny (zákonné minimum)" },
              { value: "5", label: "5 týdnů (běžné v praxi)" },
              { value: "custom", label: "Vlastní" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setEntitlementOption(option.value)}
              aria-pressed={entitlementOption === option.value}
              className={`rounded-dodio-md border px-3.5 py-2 text-sm font-medium ${
                entitlementOption === option.value
                  ? "border-dodio-teal-dark bg-dodio-teal-dark text-white"
                  : "border-dodio-border bg-white text-dodio-ink"
              }`}
            >
              {option.label}
            </button>
          ))}
          {entitlementOption === "custom" && (
            <input
              type="number"
              min={0}
              max={12}
              step={0.5}
              value={customWeeks}
              onChange={(event) => setCustomWeeks(Number(event.target.value))}
              aria-label="Vlastní výměra dovolené v týdnech"
              className="h-[42px] w-24 rounded-dodio-md border border-dodio-border bg-white px-3 text-sm text-dodio-ink"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-dodio-lg bg-[#E3F2EC] p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-dodio-teal-dark">
          Orientační nárok na dovolenou
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-dodio-display text-3xl font-extrabold text-dodio-ink lg:text-4xl">
            {formatNumber(totalHours)} h
          </span>
          <span className="text-base text-dodio-ink-muted">≈ {formatNumber(totalDays)} dní</span>
        </div>
        <a
          href={SIGNUP_URL}
          className="inline-flex w-fit items-center justify-center rounded-dodio-md bg-dodio-teal-dark px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-dodio-teal"
        >
          Spravovat dovolenou automaticky v Dodio
        </a>
      </div>

      <p className="m-0 text-xs leading-5 text-dodio-ink-muted">
        Orientační výpočet podle standardního vzorce (odpracované týdny ÷ 52 × týdenní úvazek × výměra
        dovolené) a pětidenního pracovního týdne. Nezohledňuje náhradní doby (nemoc, mateřská a rodičovská
        dovolená), nerovnoměrně rozvržený úvazek ani kolektivní smlouvu. Pro přesný výpočet se poraďte s HR
        nebo mzdovou účetní.
      </p>
    </div>
  );
}
