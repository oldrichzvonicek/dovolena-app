"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Balance, HomeOfficeYear, loadBalances, loadHomeOfficeYear, remainingOf } from "@/lib/balances";
import { formatNumber } from "@/lib/utils";

/** Slim three-card version of the dashboard balances, for the top of Moje žádosti. */
export function CompactBalances() {
  const { profile } = useAuth();
  const [vac, setVac] = useState<Balance | null>(null);
  const [sick, setSick] = useState<Balance | null>(null);
  const [ho, setHo] = useState<HomeOfficeYear | null>(null);

  function load() {
    if (!profile) return;
    loadBalances(profile.company_id, { profileId: profile.id }).then((b) => {
      setVac(b.get(profile.id, "vacation"));
      setSick(b.get(profile.id, "sick"));
    });
    loadHomeOfficeYear(profile.company_id, profile.id).then(setHo);
  }

  useEffect(load, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vac || !sick || !ho) return null;

  // Všechny tři karty mají stejnou stavbu: kolik zbývá, ukazatel a rozpad Vyčerpáno | Plánováno | Zbývá.
  const cards: { label: string; remaining: number | null; total: number | null; used: number; planned: number; color: string; note?: string }[] = [
    { label: "Dovolená", remaining: remainingOf(vac), total: vac.total, used: vac.used, planned: vac.upcoming, color: "bg-teal" },
    { label: "Sick Days", remaining: remainingOf(sick), total: sick.total, used: sick.used, planned: sick.upcoming, color: "bg-rust" },
    {
      label: "Home Office",
      remaining: ho.limit !== null ? Math.max(0, ho.limit - ho.used) : null,
      total: ho.limit,
      used: ho.taken,
      planned: ho.planned,
      color: "bg-sky",
      note: ho.limit === null ? "Bez ročního limitu" : undefined,
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {cards.map((c) => {
        const total = c.total ?? 0;
        const usedPct = total > 0 ? Math.min(100, (c.used / total) * 100) : 0;
        const plannedPct = total > 0 ? Math.min(100 - usedPct, (c.planned / total) * 100) : 0;
        return (
          <div key={c.label} className="card px-4 py-2.5">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="text-sm font-medium">
              {c.remaining !== null ? `${formatNumber(c.remaining)} z ${formatNumber(total)} dní zbývá` : `${formatNumber(c.used + c.planned)} dní letos`}
            </div>
            {total > 0 ? (
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-paper" role="img" aria-label={`${c.label}: vyčerpáno ${formatNumber(c.used)}, plánováno ${formatNumber(c.planned)}, zbývá ${formatNumber(c.remaining ?? 0)}`}>
                <div className={c.color} style={{ width: `${usedPct}%` }} />
                <div className={c.color + " opacity-40"} style={{ width: `${plannedPct}%` }} />
              </div>
            ) : (
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-paper" aria-hidden="true" />
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
              <span>Vyčerpáno: {formatNumber(c.used)}</span>
              <span>Plánováno: {formatNumber(c.planned)}</span>
              {c.note && <span>{c.note}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
