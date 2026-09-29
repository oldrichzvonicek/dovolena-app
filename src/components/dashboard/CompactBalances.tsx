"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Balance, HomeOfficeYear, loadBalances, loadHomeOfficeYear, remainingOf } from "@/lib/balances";
import { cn, formatNumber } from "@/lib/utils";

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
        // Zbývá je vždy nejsytější barva, ne vyčerpáno/plánováno — jinak pruh skoro celý zelený budil dojem
        // "zbývá spousta", i když ve skutečnosti byl skoro celý nárok už vyčerpaný nebo naplánovaný. O trochu
        // tlumenější než 100% syté (opacity-80): plný pruh v plné barvě u nuly vyčerpaného (např. "6 z 6 Sick
        // Days") jinak reflexivně čte jako "pozor, vyčerpáno", přesně naopak, než co znamená.
        const remainingPct = Math.max(0, 100 - usedPct - plannedPct);
        const remaining = c.remaining ?? total - c.used - c.planned;
        const remainingPctOfTotal = total > 0 ? (remaining / total) * 100 : 0;
        const low = c.remaining !== null && total > 0 && (remaining <= 2 || remainingPctOfTotal <= 20);
        return (
          <div key={c.label} className={cn("card relative px-4 py-2.5", low && "border-warning/40")}>
            <button
              type="button"
              aria-label={`Jak se počítá ${c.label}`}
              title={`Roční nárok − vyčerpáno − naplánováno = zbývá.${c.note ? "" : " Nevyčerpaná dovolená se do limitu může převádět z loňska."}`}
              className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-paper hover:text-ink"
            >
              <HelpCircle size={13} />
            </button>
            <div className="flex items-center gap-1.5 pr-5 text-xs text-muted">
              {c.label}
              {low && <span className="rounded-sm bg-warning-light px-1.5 py-0.5 text-[10px] font-medium text-warning-dark">Dochází</span>}
            </div>
            <div className="text-sm font-medium">
              {c.remaining !== null ? `${formatNumber(c.remaining)} z ${formatNumber(total)} dní zbývá` : `${formatNumber(c.used + c.planned)} dní letos`}
            </div>
            {total > 0 && (
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-paper" role="img" aria-label={`${c.label}: vyčerpáno ${formatNumber(c.used)}, plánováno ${formatNumber(c.planned)}, zbývá ${formatNumber(c.remaining ?? 0)}`}>
                <div className="bg-line" style={{ width: `${usedPct}%` }} />
                <div className={c.color + " opacity-40"} style={{ width: `${plannedPct}%` }} />
                <div className={c.color + " opacity-80"} style={{ width: `${remainingPct}%` }} />
              </div>
            )}
            <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink/70", total > 0 ? "mt-1.5" : "mt-1")}>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-sm bg-line" /> Vyčerpáno: {formatNumber(c.used)}
              </span>
              <span className="flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-sm", c.color, "opacity-40")} /> Naplánováno: {formatNumber(c.planned)}
              </span>
              {c.note && <span>{c.note}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
