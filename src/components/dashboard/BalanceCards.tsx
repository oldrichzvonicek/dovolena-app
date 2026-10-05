"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { countWorkingDays, dayWord } from "@/lib/working-days";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { HomeOfficeYear, loadBalances, loadHomeOfficeYear } from "@/lib/balances";

type Color = "teal" | "rust" | "moss";

const lightClass: Record<Color, string> = { teal: "bg-teal/40", rust: "bg-rust/40", moss: "bg-moss/40" };
// O trochu tlumenější než plná syta barva — celý pruh naplno tmavou/syto červenou barvou (typicky u Sick
// Days, kde 0 vyčerpáno = 100 % zbývá) čtenář reflexivně vyhodnotí jako "pozor, vyčerpáno", i když značí
// pravý opak. Pořád nejsytější ze tří segmentů, jen ne na plnou váhu.
const remainingClass: Record<Color, string> = { teal: "bg-teal/80", rust: "bg-rust/80", moss: "bg-moss/80" };

/**
 * Three segments: already taken (neutral gray — done, nothing to look at), approved but still upcoming
 * (lighter tint), and what's actually left (the strongest color of the three). The color deliberately
 * marks "zbývá", not "vyčerpáno" — a bar mostly filled in the brand color used to read as "plenty left"
 * even when the used + upcoming days had eaten almost the whole entitlement and only a sliver truly remained.
 */
function SegmentedBar({ used, upcoming, total, color }: { used: number; upcoming: number; total: number; color: Color }) {
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const upcomingPct = total > 0 ? Math.min(100 - usedPct, (upcoming / total) * 100) : 0;
  const remainingPct = Math.max(0, 100 - usedPct - upcomingPct);
  return (
    <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-paper">
      <div className="h-full bg-line" style={{ width: `${usedPct}%` }} />
      <div className={cn("h-full", lightClass[color])} style={{ width: `${upcomingPct}%` }} />
      <div className={cn("h-full", remainingClass[color])} style={{ width: `${remainingPct}%` }} />
    </div>
  );
}

function BalanceCard({
  label,
  used,
  upcoming,
  planned = 0,
  total,
  unit,
  color,
  carryover = 0,
}: {
  label: string;
  used: number;
  upcoming: number;
  /** Soukromé návrhy (leave_plans) — vlastní řádek, nepočítá se do "zbývá". */
  planned?: number;
  total: number;
  unit: string;
  color: Color;
  carryover?: number;
}) {
  const [explain, setExplain] = useState(false);
  const remaining = total - used - upcoming;
  const fmt = formatNumber;
  const remainingPct = total > 0 ? (remaining / total) * 100 : 0;
  const low = total > 0 && (remaining <= 2 || remainingPct <= 20);
  return (
    <div className={cn("card relative flex-1 p-5", low && "border-warning/40")}>
      <button
        onClick={() => setExplain((v) => !v)}
        aria-expanded={explain}
        aria-label="Jak se to počítá?"
        title="Jak se to počítá?"
        className="absolute right-3 top-3 rounded p-1 text-muted hover:bg-paper hover:text-ink"
      >
        <HelpCircle size={15} />
      </button>
      <div className="flex items-center gap-1.5 pr-6 text-sm text-muted">
        {label}
        {low && (
          <span className="rounded-sm bg-warning-light px-1.5 py-0.5 text-[11px] font-medium text-warning-dark">
            Dochází
          </span>
        )}
      </div>
      {/* Jedno číslo, jasný význam: kolik ZBÝVÁ z ročního nároku. Pruh pod ním ukazuje, kam se zbytek poděl. */}
      <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-3xl">{fmt(remaining)}</span>
        <span className="text-sm text-muted">{dayWord(remaining)} zbývá</span>
      </div>
      <SegmentedBar used={used} upcoming={upcoming} total={total} color={color} />
      {/* Jen dva doplňkové údaje — "zbývá" už je nahoře jako velké dominantní číslo, jeho opakování
          tady v legendě bylo zbytečné a se třemi tečkami se na užších obrazovkách špatně četlo. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm bg-line" /> Vyčerpáno: {fmt(used)} {dayWord(used)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-sm", lightClass[color])} /> Naplánováno: {fmt(upcoming)} {dayWord(upcoming)}
        </span>
        {planned > 0 && (
          <span className="flex items-center gap-1.5" title="Soukromý návrh — vidíte jen vy, dokud ho nepodáte ke schválení. Nepočítá se do „zbývá“.">
            <span className="h-2 w-2 shrink-0 rounded-sm border border-dashed border-line" /> V návrhu: {fmt(planned)} {dayWord(planned)}
          </span>
        )}
      </div>
      {explain && (
        <dl className="mt-2 space-y-1 rounded border border-line bg-paper p-3 text-xs">
          <div className="flex justify-between">
            <dt>Roční nárok</dt>
            <dd>{fmt(total - carryover)}</dd>
          </div>
          {carryover > 0 && (
            <div className="flex justify-between">
              <dt>Převedeno z loňska</dt>
              <dd>+ {fmt(carryover)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Už vyčerpáno</dt>
            <dd>− {fmt(used)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Schváleno do budoucna</dt>
            <dd>− {fmt(upcoming)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-1 font-medium">
            <dt>Zbývá</dt>
            <dd>{fmt(remaining)} {unit}</dd>
          </div>
          {planned > 0 && (
            <div className="flex justify-between border-t border-line pt-1 text-muted">
              <dt>V návrhu (soukromé, nepočítáno výše)</dt>
              <dd>{fmt(planned)}</dd>
            </div>
          )}
          <p className="pt-1 text-muted">Žádosti čekající na schválení a soukromé návrhy se do zůstatku nepočítají, dokud je nikdo nepodá a neschválí.</p>
        </dl>
      )}
    </div>
  );
}

export function BalanceCards() {
  const now = new Date();
  const workingDaysThisMonth = countWorkingDays(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("sv-SE"));
  const { profile } = useAuth();
  const [vacation, setVacation] = useState({ used: 0, upcoming: 0, planned: 0, total: 0, carryover: 0 });
  const [sick, setSick] = useState({ used: 0, upcoming: 0, planned: 0, total: 0 });
  const [homeOffice, setHomeOffice] = useState<HomeOfficeYear>({ used: 0, taken: 0, planned: 0, thisMonth: 0, limit: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const year = new Date().getFullYear();
    const today = new Date().toLocaleDateString("sv-SE");
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const monthStart = `${year}-${month}-01`;
    const monthEnd = new Date(year, new Date().getMonth() + 1, 0).toLocaleDateString("sv-SE");

    (async () => {
      const balances = await loadBalances(profile.company_id, { profileId: profile.id });

      const ho = await loadHomeOfficeYear(profile.company_id, profile.id);

      setVacation(balances.get(profile.id, "vacation"));
      setSick(balances.get(profile.id, "sick"));
      setHomeOffice(ho);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 md:flex-row">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-[104px] flex-1 animate-pulse bg-paper" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <BalanceCard label="Dovolená" used={vacation.used} upcoming={vacation.upcoming} planned={vacation.planned} total={vacation.total} carryover={vacation.carryover} unit="dní" color="teal" />
      <BalanceCard label="Sick Days" used={sick.used} upcoming={sick.upcoming} planned={sick.planned} total={sick.total} unit="dní" color="rust" />
      {/* Se stanoveným limitem má Home Office stejnou strukturu (zbývá / pruh / vyčerpáno+naplánováno) jako ostatní dvě karty.
          Bez limitu (firma ho nenastavila) zůstává jednodušší — nedá se počítat "zbývá" bez celkového nároku. */}
      {homeOffice.limit !== null ? (
        <BalanceCard label="Home Office" used={homeOffice.taken} upcoming={homeOffice.planned} total={homeOffice.limit} unit="dní" color="moss" />
      ) : (
        <div className="card flex-1 p-5">
          <div className="text-sm text-muted">Home Office letos</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-display text-3xl">{formatNumber(homeOffice.used)}</span>
            <span className="text-sm text-muted">{dayWord(homeOffice.used)} letos</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-sm bg-moss" /> Vyčerpáno: {formatNumber(homeOffice.taken)} {dayWord(homeOffice.taken)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-sm bg-moss/40" /> Naplánováno: {formatNumber(homeOffice.planned)} {dayWord(homeOffice.planned)}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-muted">
            Tento měsíc: {formatNumber(homeOffice.thisMonth)} {dayWord(homeOffice.thisMonth)} · bez ročního limitu
          </div>
        </div>
      )}
    </div>
  );
}
