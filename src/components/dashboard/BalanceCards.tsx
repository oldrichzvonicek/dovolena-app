"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { countWorkingDays, dayWord } from "@/lib/working-days";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { HomeOfficeYear, loadBalances, loadHomeOfficeYear } from "@/lib/balances";

type Color = "teal" | "rust" | "moss";

const solidClass: Record<Color, string> = { teal: "bg-teal", rust: "bg-rust", moss: "bg-moss" };
const lightClass: Record<Color, string> = { teal: "bg-teal/40", rust: "bg-rust/40", moss: "bg-moss/40" };

/** Three segments: already taken (solid), approved but still upcoming (lighter), and what's left (background). */
function SegmentedBar({ used, upcoming, total, color }: { used: number; upcoming: number; total: number; color: Color }) {
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const upcomingPct = total > 0 ? Math.min(100 - usedPct, (upcoming / total) * 100) : 0;
  return (
    <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-paper">
      <div className={cn("h-full", solidClass[color])} style={{ width: `${usedPct}%` }} />
      <div className={cn("h-full", lightClass[color])} style={{ width: `${upcomingPct}%` }} />
    </div>
  );
}

function BalanceCard({
  label,
  used,
  upcoming,
  total,
  unit,
  color,
  carryover = 0,
}: {
  label: string;
  used: number;
  upcoming: number;
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-sm", solidClass[color])} /> Vyčerpáno: {fmt(used)} {dayWord(used)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-sm", lightClass[color])} /> Naplánováno: {fmt(upcoming)} {dayWord(upcoming)}
        </span>
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
          <p className="pt-1 text-muted">Žádosti čekající na schválení se do zůstatku nepočítají, dokud je nikdo neschválí. Půldny se počítají jako 0,5 dne, víkendy a svátky se neodečítají.</p>
        </dl>
      )}
    </div>
  );
}

export function BalanceCards() {
  const now = new Date();
  const workingDaysThisMonth = countWorkingDays(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("sv-SE"));
  const { profile } = useAuth();
  const [vacation, setVacation] = useState({ used: 0, upcoming: 0, total: 0, carryover: 0 });
  const [sick, setSick] = useState({ used: 0, upcoming: 0, total: 0 });
  const [homeOffice, setHomeOffice] = useState<HomeOfficeYear>({ used: 0, thisMonth: 0, limit: null });
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
      <BalanceCard label="Dovolená" used={vacation.used} upcoming={vacation.upcoming} total={vacation.total} carryover={vacation.carryover} unit="dní" color="teal" />
      <BalanceCard label="Sick Days" used={sick.used} upcoming={sick.upcoming} total={sick.total} unit="dní" color="rust" />
      <div className={cn("card flex-1 p-5", homeOffice.limit !== null && homeOffice.used > homeOffice.limit && "border-warning/40")}>
        <div className="text-sm text-muted">Home Office letos</div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-display text-3xl">{formatNumber(homeOffice.used)}</span>
          <span className="text-sm text-muted">{homeOffice.limit !== null ? `z ${formatNumber(homeOffice.limit)} dní` : "dní"}</span>
        </div>
        <div className="mt-2 text-[11px] text-muted">
          Tento měsíc: {formatNumber(homeOffice.thisMonth)} {dayWord(homeOffice.thisMonth)}
          {homeOffice.limit !== null && <> · zbývá {formatNumber(Math.max(0, homeOffice.limit - homeOffice.used))}</>}
        </div>
      </div>
    </div>
  );
}
