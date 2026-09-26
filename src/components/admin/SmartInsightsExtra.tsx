"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarRange, Clock3, Home, KeyRound, Link2, Scale, Sparkles, Stethoscope, TrendingUp, UserRoundPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { loadBalances, remainingOf } from "@/lib/balances";
import { DEFAULT_WORK_DAYS } from "@/lib/working-days";
import { MIN_GROUP } from "@/lib/insights";
import {
  bridgeShare,
  cz,
  dayWordCs,
  decisionStats,
  homeOfficeShare,
  joinersLeavers,
  keyPeopleRisk,
  leadTime,
  sickPattern,
  substituteRisk,
  vacationCurve,
  weeklyFindings,
  type ExtraResults,
  type Finding,
  type XDept,
  type XPerson,
  type XRequest,
} from "@/lib/insights-extra";
import { Card, Empty, Row } from "@/components/admin/insight-ui";
import { cn } from "@/lib/utils";
import { formatKc } from "@/lib/plans";

const WEEKDAY = ["", "po", "út", "st", "čt", "pá", "so", "ne"];
const MONTH = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];
const dmy = (iso: string) => format(parseISO(iso), "d. M.", { locale: cs });
const range = (from: string, to: string) => (from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`);

export interface ExtraInsights {
  results: ExtraResults;
  findings: Finding[];
  nameOf: (id: string) => string;
  dailyCost: number | null;
}

/** Načte data pro další karty Smart HR Insights (vlastní dotazy, aby se hlavní komponenta nezatěžovala). */
export function useExtraInsights(companyId: string | undefined, enabled: boolean, departmentId: string): ExtraInsights | null {
  const [state, setState] = useState<ExtraInsights | null>(null);
  useEffect(() => {
    if (!companyId || !enabled) return;
    let cancelled = false;
    const supabase = createClient();
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const since = format(new Date(now.getTime() - 400 * 86400_000), "yyyy-MM-dd");
    (async () => {
      const [{ data: people }, { data: depts }, { data: company }, { data: hrs }, reqs, balances] = await Promise.all([
        supabase.from("profiles").select("id, name, department_id, substitute_id, active, created_at, deactivated_at").eq("company_id", companyId),
        supabase.from("departments").select("id, name, head_profile_id, deputy_head_profile_id").eq("company_id", companyId),
        supabase.from("companies").select("work_days").eq("id", companyId).single(),
        supabase.from("company_hr_settings").select("avg_daily_cost").eq("company_id", companyId).maybeSingle(),
        fetchAll<XRequest>((a, b) =>
          supabase
            .from("leave_requests")
            .select("profile_id, start_date, end_date, half_day, working_days, status, created_at, approved_by, leave_type:leave_types(key, counts_against, counts_as_present)")
            .in("status", ["approved", "pending", "rejected"])
            .gte("end_date", since)
            .order("id")
            .range(a, b) as unknown as PromiseLike<{ data: XRequest[] | null; error: { message: string } | null }>
        ),
        loadBalances(companyId),
      ]);
      const workDays = (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const all = ((people as unknown as XPerson[]) ?? []).filter((p) => departmentId === "all" || p.department_id === departmentId);
      const ids = new Set(all.map((p) => p.id));
      const requests = reqs.data.filter((r) => ids.has(r.profile_id));
      const deptList = ((depts as unknown as XDept[]) ?? []).filter((d) => departmentId === "all" || d.id === departmentId);
      const active = all.filter((p) => p.active);
      const remaining = new Map<string, number>();
      for (const p of all) {
        const b = balances.get(p.id, "vacation");
        if (p.active ? b.total > 0 : b.total > 0 || b.used > 0) remaining.set(p.id, remainingOf(b));
      }
      const activeRemaining = new Map(Array.from(remaining).filter(([id]) => active.some((p) => p.id === id)));
      const dailyCost = hrs?.avg_daily_cost !== null && hrs?.avg_daily_cost !== undefined ? Number(hrs.avg_daily_cost) : null;
      const results: ExtraResults = {
        curve: vacationCurve(requests, today, workDays, activeRemaining),
        bridge: bridgeShare(requests, today, workDays),
        subs: substituteRisk(all, requests, today),
        lead: leadTime(requests, active, deptList, today),
        decisions: decisionStats(requests, active, deptList, today),
        sick: sickPattern(requests, active.length, today, workDays),
        home: homeOfficeShare(requests, all, deptList, today, workDays),
        key: keyPeopleRisk(deptList, all, requests, today),
        moves: joinersLeavers(all, remaining, today, dailyCost),
      };
      const names = new Map(((people as unknown as XPerson[]) ?? []).map((p) => [p.id, p.name]));
      const nameOf = (id: string) => names.get(id) ?? "Neznámý";
      if (!cancelled) setState({ results, findings: weeklyFindings(results, today, nameOf), nameOf, dailyCost });
    })().catch((e) => console.error("SmartInsightsExtra failed:", e));
    return () => {
      cancelled = true;
    };
  }, [companyId, enabled, departmentId]);
  return state;
}

const DOT: Record<Finding["severity"], string> = { 3: "bg-danger", 2: "bg-warning", 1: "bg-teal" };

/** Jedna karta s nejdůležitějšími zjištěními týdne. */
export function ExtraSummary({ extra }: { extra: ExtraInsights }) {
  const top = extra.findings.slice(0, 5);
  return (
    <Card className="lg:col-span-2" icon={<Sparkles size={17} className="text-teal-dark" />} title="Shrnutí týdne" hint="To nejdůležitější ze všech karet níže, seřazené podle naléhavosti. Nejde o hodnocení jednotlivců.">
      {top.length === 0 ? (
        <Empty text="Tento týden není nic, co by vyžadovalo pozornost." />
      ) : (
        <ul className="space-y-2">
          {top.map((f, i) => (
            <li key={i} className="flex gap-2.5">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[f.severity])} aria-label={f.severity === 3 ? "Řešit hned" : f.severity === 2 ? "Pozor" : "K zamyšlení"} />
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      )}
      {extra.findings.length > top.length && <p className="text-xs text-muted">a dalších {extra.findings.length - top.length} zjištění v kartách níže.</p>}
    </Card>
  );
}

function Bars({ items, unit = "", highlight }: { items: { label: string; value: number; muted?: boolean }[]; unit?: string; highlight?: (v: number) => boolean }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 96 }}>
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${i.label}: ${i.value}${unit}`}>
          <span className="text-[10px] text-muted">{i.value > 0 ? i.value : ""}</span>
          <div className={cn("w-full rounded-t", highlight?.(i.value) ? "bg-warning/70" : i.muted ? "bg-teal/25" : "bg-teal/60")} style={{ height: `${Math.max(2, (i.value / max) * 64)}px` }} />
          <span className="text-[10px] text-muted">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Seznam jmen s možností rozbalit zbytek. */
function Names({ ids, nameOf, limit = 6 }: { ids: string[]; nameOf: (id: string) => string; limit?: number }) {
  const [all, setAll] = useState(false);
  const list = ids.map(nameOf).sort((a, b) => a.localeCompare(b, "cs"));
  const shown = all ? list : list.slice(0, limit);
  return (
    <p className="text-xs">
      {shown.join(", ")}
      {list.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="ml-1.5 text-teal-dark underline underline-offset-2">
          {all ? "méně" : `a dalších ${list.length - limit}`}
        </button>
      )}
    </p>
  );
}

/** Devět dalších karet. Vkládá se do mřížky karet Smart HR Insights. */
export function ExtraCards({ extra }: { extra: ExtraInsights }) {
  const { results: r, nameOf, dailyCost } = extra;
  return (
    <>
      <Card className="lg:col-span-2" icon={<TrendingUp size={17} className="text-teal-dark" />} title="Hokejka dovolené" hint="Dny dovolené (schválené i čekající) po měsících letošního roku a dovolená, kterou si lidé ještě nenaplánovali.">
        <Bars items={r.curve.months.map((m) => ({ label: MONTH[m.month - 1], value: m.days, muted: m.future }))} unit=" dní" />
        {r.curve.unplanned.length === 0 ? (
          <Empty text="Všichni mají zbývající dovolenou naplánovanou." />
        ) : (
          <>
            <Row
              left={`Nenaplánováno: ${r.curve.unplanned.length} ${r.curve.unplanned.length === 1 ? "člověk" : "lidí"}`}
              right={`${cz(r.curve.totalUnplanned)} ${dayWordCs(Math.round(r.curve.totalUnplanned))}${r.curve.weeksLeft > 0 ? ` · ≈ ${cz(r.curve.perWeek)} dne týdně do konce roku` : ""}`}
              tone={Number(format(new Date(), "M")) >= 9 ? "warning" : undefined}
            />
            <Names ids={r.curve.unplanned.map((u) => u.id)} nameOf={nameOf} />
          </>
        )}
      </Card>

      <Card icon={<KeyRound size={17} className="text-teal-dark" />} title="Kolize vedoucích" hint="Kdy v příštích 90 dnech chybí vedoucí oddělení i jeho zástupce zároveň, a oddělení bez zástupce vedoucího.">
        {r.key.clashes.length === 0 && r.key.noDeputy.length === 0 && <Empty text="Žádné kolize ani chybějící zástupci." />}
        {r.key.clashes.slice(0, 6).map((c, i) => (
          <Row key={i} left={`${c.dept}: ${nameOf(c.headId)} + ${nameOf(c.deputyId)}`} right={range(c.from, c.to)} tone="danger" />
        ))}
        {r.key.noDeputy.slice(0, 6).map((d) => (
          <Row key={d.dept} left={`${d.dept}: chybí zástupce vedoucího`} right="doplnit" tone="warning" />
        ))}
      </Card>

      <Card icon={<Link2 size={17} className="text-teal-dark" />} title="Zástupy" hint="Kdo má určený zástup, kdo zastupuje víc kolegů a kdy v příštích 60 dnech chybí člověk i jeho zástup.">
        {r.subs.clashes.length === 0 && <Empty text="Nikdo nechybí zároveň se svým zástupem." />}
        {r.subs.clashes.slice(0, 6).map((c, i) => (
          <Row key={i} left={`${nameOf(c.personId)} a zástup ${nameOf(c.substituteId)}`} right={range(c.from, c.to)} tone="danger" />
        ))}
        {r.subs.overloaded.slice(0, 4).map((o) => (
          <Row key={o.id} left={`${nameOf(o.id)} zastupuje ${o.covers.length} lidí`} right="přetížený zástup" tone="warning" />
        ))}
        {r.subs.noSubstitute.length > 0 && (
          <>
            <Row left={`Bez určeného zástupu`} right={`${r.subs.noSubstitute.length}`} tone="warning" />
            <Names ids={r.subs.noSubstitute} nameOf={nameOf} />
          </>
        )}
      </Card>

      <Card icon={<CalendarRange size={17} className="text-teal-dark" />} title="Víkendy a mosty" hint="Jak často dovolená navazuje na víkend či svátek a které dny v týdnu jsou nejvíc obsazené (poslední rok).">
        {r.bridge.total === 0 ? (
          <Empty text="Zatím nejsou data." />
        ) : (
          <>
            <Row left={`Dovolené navazující na víkend nebo svátek (z ${r.bridge.total})`} right={`${r.bridge.pct} %`} tone={r.bridge.pct >= 70 ? "warning" : undefined} />
            <Bars items={r.bridge.byWeekday.map((w) => ({ label: WEEKDAY[w.weekday], value: w.days }))} unit=" dní" />
          </>
        )}
      </Card>

      <Card icon={<Clock3 size={17} className="text-teal-dark" />} title="Předstih žádostí" hint="Kolik dní před nástupem lidé o dovolenou žádají. Oddělení s aspoň 5 lidmi.">
        {r.lead.overall.requests === 0 ? (
          <Empty text="Zatím nejsou data." />
        ) : (
          <>
            <Row left={`Celá firma: medián ${r.lead.overall.medianDays} dní předem`} right={`${r.lead.overall.shortPct} % do 3 dnů`} tone={r.lead.overall.shortPct >= 30 ? "warning" : undefined} />
            {r.lead.rows.slice(0, 6).map((d) => (
              <Row key={d.dept} left={`${d.dept}: medián ${d.medianDays} dní`} right={`${d.shortPct} % do 3 dnů`} tone={d.shortPct >= 40 ? "warning" : undefined} />
            ))}
          </>
        )}
      </Card>

      <Card icon={<Scale size={17} className="text-teal-dark" />} title="Schvalování a zamítání" hint="Podíl zamítnutých dovolených za poslední rok. Oddělení a schvalovatelé se aspoň 5 vyřízenými žádostmi.">
        {r.decisions.overall.decided === 0 ? (
          <Empty text="Zatím nejsou vyřízené žádosti." />
        ) : (
          <>
            <Row left={`Celá firma (${r.decisions.overall.decided} vyřízených)`} right={`${r.decisions.overall.rejectedPct} % zamítnuto`} />
            {r.decisions.byDept.slice(0, 5).map((d) => (
              <Row key={d.dept} left={`${d.dept} (${d.decided})`} right={`${d.rejectedPct} %`} tone={d.rejectedPct >= 40 ? "warning" : undefined} />
            ))}
            {r.decisions.byApprover.length > 0 && <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Podle schvalovatele</div>}
            {r.decisions.byApprover.slice(0, 5).map((a) => (
              <Row key={a.approverId} left={`${nameOf(a.approverId)} (${a.decided})`} right={`${a.rejectedPct} %`} />
            ))}
          </>
        )}
      </Card>

      <Card icon={<Home size={17} className="text-teal-dark" />} title="Home Office" hint="Podíl pracovních dnů na Home Office za posledních 90 dní, podle dne v týdnu a oddělení.">
        {!r.home ? (
          <Empty text={`Málo lidí na smysluplný souhrn (aspoň ${MIN_GROUP}).`} />
        ) : (
          <>
            <Row left="Celá firma" right={`${r.home.overallPct} %`} />
            <Bars items={r.home.byWeekday.map((w) => ({ label: WEEKDAY[w.weekday], value: w.pct }))} unit=" %" />
            {r.home.byDept.slice(0, 6).map((d) => (
              <Row key={d.dept} left={d.dept} right={`${d.pct} %`} />
            ))}
          </>
        )}
      </Card>

      {r.sick && (
        <Card icon={<Stethoscope size={17} className="text-teal-dark" />} title="Krátké nemoci (souhrnně)" hint="Jen souhrn za celou firmu, bez jmen a bez rozpadu na oddělení. Krátká nemoc = do 2 pracovních dnů; ukazuje, ve který den v týdnu začíná.">
          {r.sick.shortEpisodes === 0 ? (
            <Empty text="Za poslední rok žádné krátké nemoci." />
          ) : (
            <>
              <Bars items={r.sick.shortByStartWeekday.map((w) => ({ label: WEEKDAY[w.weekday], value: w.count }))} />
              <Row left={`Krátké nemoci (z ${r.sick.episodes} všech)`} right={`${r.sick.shortEpisodes}`} />
              <Row left="Začínají v pondělí nebo v pátek" right={`${r.sick.mondayFridayPct} %`} tone={r.sick.shortEpisodes >= 8 && r.sick.mondayFridayPct >= 60 ? "warning" : undefined} />
            </>
          )}
        </Card>
      )}

      <Card icon={<UserRoundPlus size={17} className="text-teal-dark" />} title="Nováčci a odchody" hint="Nováčci za posledních 90 dní a lidé, kteří za posledních 180 dní odešli, s nevyčerpanou dovolenou a odhadem vyrovnání.">
        {r.moves.joiners.length === 0 && r.moves.leavers.length === 0 && <Empty text="Za poslední dobu žádní nováčci ani odchody." />}
        {r.moves.joiners.length > 0 && <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Nováčci</div>}
        {r.moves.joiners.slice(0, 6).map((j) => (
          <Row key={j.id} left={nameOf(j.id)} right={j.days !== null ? `zbývá ${cz(Math.round(j.days * 10) / 10)} ${dayWordCs(Math.round(j.days))}` : "zůstatek nezadán"} />
        ))}
        {r.moves.leavers.length > 0 && <div className="pt-1 text-[11px] font-medium uppercase tracking-wide text-muted">Odchody</div>}
        {r.moves.leavers.slice(0, 6).map((l) => (
          <Row key={l.id} left={nameOf(l.id)} right={`${cz(l.remaining)} ${dayWordCs(Math.round(Math.abs(l.remaining)))}${l.amount !== null ? ` ≈ ${formatKc(l.amount)}` : dailyCost === null && l.remaining > 0 ? "" : ""}`} tone={l.remaining > 0 ? "warning" : "danger"} />
        ))}
        {r.moves.leavers.some((l) => l.remaining > 0) && dailyCost === null && <p className="text-xs text-muted">Odhad částky doplníte zadáním průměrných nákladů na den v kartě Závazek z dovolené.</p>}
      </Card>
    </>
  );
}

