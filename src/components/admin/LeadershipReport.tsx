"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfMonth, endOfQuarter, endOfYear, format, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { cs } from "date-fns/locale";
import { Copy, Printer } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { loadBalances, remainingOf } from "@/lib/balances";
import { approvalSpeed, type Decision } from "@/lib/insights";
import { DEFAULT_MINUTES_PER_REQUEST, estimateTimeSaved, forfeitRisk, reportText, type ForfeitRisk } from "@/lib/leadership-report";
import { formatKc } from "@/lib/plans";
import { showToast } from "@/lib/toast";
import { cn, formatNumber } from "@/lib/utils";
import type { ExtraInsights } from "@/components/admin/SmartInsightsExtra";

type Period = "month" | "quarter" | "year";
const PERIODS: { key: Period; label: string }[] = [
  { key: "month", label: "Tento měsíc" },
  { key: "quarter", label: "Toto čtvrtletí" },
  { key: "year", label: "Tento rok" },
];
const MINUTES_KEY = "dodio:minutes-per-request";

function bounds(p: Period, now: Date) {
  const fn = p === "month" ? [startOfMonth, endOfMonth] : p === "quarter" ? [startOfQuarter, endOfQuarter] : [startOfYear, endOfYear];
  const from = fn[0](now);
  const to = fn[1](now);
  const label = p === "month" ? format(now, "LLLL yyyy", { locale: cs }) : p === "quarter" ? `${Math.floor(now.getMonth() / 3) + 1}. čtvrtletí ${now.getFullYear()}` : String(now.getFullYear());
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd"), label };
}

interface Loaded {
  company: string;
  decided: number;
  medianHours: number | null;
  risk: ForfeitRisk;
  dailyCost: number | null;
  hoursPerDay: number;
}

/** Jednostránkový přehled pro vedení: odhad ušetřeného času a riziko propadnutí dovolené (+ plánovací rizika ze Smart HR). */
export function LeadershipReport({ departmentId, extra }: { departmentId: string; extra: ExtraInsights | null }) {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("year");
  const [data, setData] = useState<Loaded | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [askMinutes, setAskMinutes] = useState(false);
  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => bounds(period, now), [period, now]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MINUTES_KEY);
      if (saved && Number(saved) >= 0) setMinutes(Number(saved));
      else setAskMinutes(true);
    } catch {
      setAskMinutes(true);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      const q = supabase.from("profiles").select("id, department_id").eq("company_id", profile.company_id).eq("active", true);
      const [{ data: people }, { data: depts }, { data: company }, { data: hrs }, balances, decisions] = await Promise.all([
        departmentId === "all" ? q : q.eq("department_id", departmentId),
        supabase.from("departments").select("id, name").eq("company_id", profile.company_id),
        supabase.from("companies").select("name, max_carryover_days, standard_daily_hours").eq("id", profile.company_id).single(),
        supabase.from("company_hr_settings").select("avg_daily_cost").eq("company_id", profile.company_id).maybeSingle(),
        loadBalances(profile.company_id),
        fetchAll<Decision>((a, b) =>
          supabase
            .from("audit_log")
            .select("id, actor_id, entity_id, action, created_at")
            .in("action", ["request.approved", "request.rejected"])
            .gte("created_at", `${range.from}T00:00:00`)
            .lte("created_at", `${range.to}T23:59:59`)
            .order("id")
            .range(a, b) as unknown as PromiseLike<{ data: Decision[] | null; error: { message: string } | null }>
        ),
      ]);
      const decs = decisions.data.filter((d) => d.entity_id);
      const submitted = new Map<string, string>();
      const ids = Array.from(new Set(decs.map((d) => d.entity_id)));
      for (let i = 0; i < ids.length; i += 200) {
        const { data: created } = await supabase.from("leave_requests").select("id, created_at").in("id", ids.slice(i, i + 200));
        for (const c of created ?? []) submitted.set(c.id as string, c.created_at as string);
      }
      const speed = approvalSpeed(decs, submitted, 1);
      const maxCarry = company?.max_carryover_days !== null && company?.max_carryover_days !== undefined ? Number(company.max_carryover_days) : null;
      const list = ((people as { id: string; department_id: string | null }[]) ?? []).map((p) => {
        const b = balances.get(p.id, "vacation");
        return { departmentId: p.department_id, remaining: b.total > 0 ? remainingOf(b) : 0 };
      });
      const dailyCost = hrs?.avg_daily_cost !== null && hrs?.avg_daily_cost !== undefined ? Number(hrs.avg_daily_cost) : null;
      const risk = forfeitRisk(list, new Map(((depts as { id: string; name: string }[]) ?? []).map((d) => [d.id, d.name])), maxCarry, dailyCost);
      if (alive)
        setData({ company: (company?.name as string) ?? "Firma", decided: decs.length, medianHours: speed.overallMedianHours > 0 ? speed.overallMedianHours : null, risk, dailyCost, hoursPerDay: Number(company?.standard_daily_hours ?? 8) });
    })().catch((e) => console.error("LeadershipReport failed:", e));
    return () => {
      alive = false;
    };
  }, [profile, departmentId, range.from, range.to]);

  function saveMinutes(v: number) {
    setMinutes(v);
    setAskMinutes(false);
    try {
      localStorage.setItem(MINUTES_KEY, String(v));
    } catch {
      /* uloží se jen pro tuto relaci */
    }
  }

  if (!data) return <p className="text-sm text-muted">Načítám report…</p>;
  const usedMinutes = minutes ?? DEFAULT_MINUTES_PER_REQUEST;
  const saved = estimateTimeSaved(data.decided, usedMinutes, data.dailyCost, data.hoursPerDay);
  const collisions = (extra?.results.key.clashes.length ?? 0) + (extra?.results.subs.clashes.length ?? 0);
  const noSub = extra?.results.subs.noSubstitute.length ?? 0;
  const shortNotice = extra && extra.results.lead.overall.requests >= 10 ? extra.results.lead.overall.shortPct : null;

  const actions: string[] = [];
  if (data.risk.atRiskPeople > 0) actions.push(`Pošlete výzvu k vyčerpání ${data.risk.atRiskPeople} lidem s velkým zůstatkem dovolené.`);
  if (data.risk.totalDays > 0 && data.dailyCost === null) actions.push("Zadejte průměrné denní náklady (Smart HR → Lidé a zůstatky), ať se riziko vyčíslí v Kč.");
  if (collisions > 0) actions.push(`Vyřešte ${collisions} kapacitních kolizí nebo kolizí zástupů v příštích dnech.`);
  if (noSub > 0) actions.push(`Určete zástup u ${noSub} lidí.`);
  if (shortNotice !== null && shortNotice >= 30) actions.push(`Připomeňte dřívější plánování: ${shortNotice} % dovolených se žádá s předstihem do 3 dnů.`);

  async function copySummary() {
    const text = reportText({ company: data!.company, period: range.label, saved, medianHours: data!.medianHours, risk: data!.risk, collisions, noSubstitute: noSub });
    try {
      await navigator.clipboard.writeText(text);
      showToast("Shrnutí je zkopírované, vložte ho do e-mailu vedení.");
    } catch {
      showToast("Kopírování se nepovedlo. Použijte tisk do PDF.", "error");
    }
  }

  return (
    <div className="space-y-4 lg:col-span-2">
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Období reportu">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} aria-pressed={period === p.key} className={cn("rounded-full border px-3 py-1 text-xs", period === p.key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper")}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={copySummary} className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-paper">
            <Copy size={13} /> Kopírovat shrnutí do e-mailu
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-paper">
            <Printer size={13} /> Tisk / PDF
          </button>
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <div>
          <h2 className="font-display text-h2">Přehled pro vedení</h2>
          <p className="text-sm text-muted">
            {data.company} · {range.label}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded border border-line p-4">
            <div className="text-xs text-muted">Vyřízených žádostí</div>
            <div className="mt-1 font-display text-3xl">{formatNumber(saved.requests)}</div>
            <div className="mt-1 text-[11px] text-muted">schválených a zamítnutých</div>
          </div>
          <div className="rounded border border-line p-4">
            <div className="text-xs text-muted">Odhad ušetřeného času</div>
            <div className="mt-1 font-display text-3xl">{formatNumber(saved.hours)} h</div>
            <div className="mt-1 text-[11px] text-muted">
              {saved.requests} × {formatNumber(saved.minutesPerRequest)} min na žádost (odhad){saved.amount !== null ? `, asi ${formatKc(saved.amount)}` : ""}
            </div>
          </div>
          <div className="rounded border border-line p-4">
            <div className="text-xs text-muted">Medián doby schválení</div>
            <div className="mt-1 font-display text-3xl">{data.medianHours !== null ? `${formatNumber(data.medianHours)} h` : "—"}</div>
            <div className="mt-1 text-[11px] text-muted">naměřeno z historie rozhodnutí</div>
          </div>
        </div>

        {askMinutes && (
          <div className="no-print rounded border border-warning/40 bg-warning-light px-4 py-3 text-sm text-warning-dark">
            Kolik minut vám v průměru ušetří vyřízení jedné žádosti v Dodiu proti e-mailu nebo papíru? Číslo je jen váš odhad a ukládá se v tomto prohlížeči.
            <span className="ml-2 inline-flex flex-wrap items-center gap-1.5">
              {[3, 6, 10, 15].map((m) => (
                <button key={m} onClick={() => saveMinutes(m)} className="rounded border border-warning/60 bg-white px-2.5 py-0.5 text-xs font-medium hover:bg-warning/10">
                  {m} min
                </button>
              ))}
            </span>
          </div>
        )}
        {!askMinutes && (
          <p className="no-print text-xs text-muted">
            Odhad počítá s {formatNumber(usedMinutes)} min na žádost.{" "}
            <button className="underline hover:text-ink" onClick={() => setAskMinutes(true)}>
              Změnit
            </button>
          </p>
        )}

        <div>
          <h3 className="text-sm font-medium">Riziko propadnutí dovolené</h3>
          {data.risk.totalDays === 0 ? (
            <p className="mt-1 text-sm text-muted">✓ Při současných zůstatcích nepropadne žádná dovolená.</p>
          ) : (
            <>
              <p className="mt-1 text-sm">
                Propadne <strong>{formatNumber(data.risk.totalDays)} dní</strong> u {data.risk.people} {data.risk.people === 1 ? "člověka" : "lidí"}
                {data.risk.amount !== null && (
                  <>
                    , což je asi <strong>{formatKc(data.risk.amount)}</strong>
                  </>
                )}
                , pokud se do konce roku nic nezmění.
              </p>
              {data.risk.byDept.length > 0 && (
                <table className="mt-2 w-full max-w-lg text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-1.5 font-medium">Oddělení</th>
                      <th className="py-1.5 text-right font-medium">Lidí</th>
                      <th className="py-1.5 text-right font-medium">Dní</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.risk.byDept.map((d) => (
                      <tr key={d.dept} className="border-b border-line last:border-0">
                        <td className="py-1.5">{d.dept}</td>
                        <td className="py-1.5 text-right tabular-nums">{d.people}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatNumber(d.days)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-1 text-[11px] text-muted">Jen souhrny bez jmen. Jména jsou v kartě Zůstatky.</p>
            </>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium">Zdraví plánování</h3>
          <ul className="mt-1 space-y-0.5 text-sm">
            <li>{collisions === 0 ? "✓ Žádné kapacitní kolize ani kolize zástupů v příštích dnech." : `⚠️ Kolize kapacity a zástupů v příštích dnech: ${collisions}.`}</li>
            <li>{noSub === 0 ? "✓ Všichni mají určený zástup." : `Bez určeného zástupu: ${noSub}.`}</li>
            {shortNotice !== null && <li>Žádosti s předstihem do 3 dnů: {shortNotice} %.</li>}
          </ul>
        </div>

        {actions.length > 0 && (
          <div className="rounded bg-paper px-4 py-3">
            <h3 className="text-sm font-medium">Doporučené kroky</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {actions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            {data.risk.atRiskPeople > 0 && (
              <Link href="/admin/overview" className="no-print mt-2 inline-block text-sm font-medium text-teal-dark underline underline-offset-2">
                Otevřít výzvu k vyčerpání (Analytika → Operativní plánování)
              </Link>
            )}
          </div>
        )}
        <p className="text-[11px] text-muted">Ušetřený čas je odhad z uvedeného předpokladu, ostatní údaje vycházejí z dat v Dodiu. Vygenerováno {format(now, "d. M. yyyy", { locale: cs })}.</p>
      </div>
    </div>
  );
}
