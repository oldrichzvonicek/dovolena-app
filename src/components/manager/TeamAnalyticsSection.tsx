"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { cs } from "date-fns/locale";
import { AlertTriangle, Check, Eye, Mail, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchDecisionScope } from "@/lib/approval-scope";
import { loadBalances, remainingOf } from "@/lib/balances";
import { capacityHeatmap, type InDept, type InPerson, type InRequest } from "@/lib/insights";
import { reducesPresence } from "@/lib/leave-kinds";
import { leaveColorBg } from "@/lib/leave-colors";
import { DEFAULT_WORK_DAYS, countWorkingDays, dayWord, daysWithin } from "@/lib/working-days";
import { cn, errorMessage, formatNumber } from "@/lib/utils";
import { sendWellbeingReminder } from "@/lib/notifications";
import { showToast } from "@/lib/toast";
import { LoadingCard } from "@/components/ui/skeleton";
import { DbDepartment, DbProfile, LeaveColor } from "@/lib/supabase/types";

/** Nevyčerpaná dovolená nad tuto hranici se počítá jako riziko nápor na konci roku. */
const AT_RISK_DAYS = 10;
/** Kolik týdnů dopředu se hlídá kapacitní předpověď. */
const FORECAST_WEEKS = 5;

interface TeamMember {
  id: string;
  name: string;
  department_id: string | null;
  manager_id: string | null;
  substitute_id: string | null;
}
interface PersonTypeDays {
  label: string;
  color: LeaveColor;
  days: number;
}
interface PersonRow {
  id: string;
  name: string;
  total: number;
  byType: PersonTypeDays[];
}
interface BalanceRow {
  id: string;
  name: string;
  vacationTotal: number;
  vacationRemaining: number;
  sickTotal: number;
  sickRemaining: number;
  hoThisMonth: number;
  hoYearlyLimit: number | null;
}
interface CriticalWeek {
  weekStart: string;
  dept: string;
  size: number;
  peakCount: number;
  peakPct: number;
}
interface TeamState {
  teamSize: number;
  capacityThisMonth: number;
  capacityNextMonth: number;
  warnThisMonth: boolean;
  warnNextMonth: boolean;
  atRiskCount: number;
  hoUsedThisMonth: number;
  hoBudgetThisMonth: number | null;
  pendingCount: number;
  oldestWaitDays: number;
  personRows: PersonRow[];
  criticalWeeks: CriticalWeek[];
  collisionCount: number;
  balanceRows: BalanceRow[];
}

function balanceTone(remaining: number): "overdrawn" | "risk" | "normal" {
  if (remaining < 0) return "overdrawn";
  if (remaining > AT_RISK_DAYS) return "risk";
  return "normal";
}

function BalanceCell({ total, remaining }: { total: number; remaining: number }) {
  const tone = balanceTone(remaining);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-sm",
        tone === "overdrawn" && "font-medium text-danger-dark",
        tone === "risk" && "font-medium text-warning-dark"
      )}
      title={tone === "risk" ? `Víc než ${AT_RISK_DAYS} dní nevyčerpáno — riziko náporu na konci roku` : undefined}
    >
      {tone === "overdrawn" && "🔴 "}
      zbývá {formatNumber(remaining)} z {formatNumber(total)}
    </span>
  );
}

/**
 * Analytika zaměřená na manažerův tým (ne celou firmu): kapacita a zůstatky jeho podřízených, srovnání mezi
 * nimi, kapacitní předpověď a souběhy v nejbližších týdnech, a pár postřehů shrnutých do vět. Nahrazuje
 * celofiremní KPI a graf podle oddělení, které pro vedoucího jednoho týmu nemají velkou výpovědní hodnotu.
 */
export function TeamAnalyticsSection({
  profile,
  departments,
  range,
  onOpenDetail,
}: {
  profile: DbProfile;
  departments: DbDepartment[];
  range: { from: string; to: string; label: string };
  onOpenDetail: (p: { id: string; name: string }) => void;
}) {
  const [state, setState] = useState<TeamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [remindSent, setRemindSent] = useState<Set<string>>(new Set());
  const [remindError, setRemindError] = useState<string | null>(null);
  const deptIdsKey = departments.map((d) => d.id).join(",");

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    setLoading(true);
    const supabase = createClient();
    const year = new Date().getFullYear();
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const thisStart = format(startOfMonth(now), "yyyy-MM-dd");
    const thisEnd = format(endOfMonth(now), "yyyy-MM-dd");
    const nextMonthDate = addMonths(now, 1);
    const nextStart = format(startOfMonth(nextMonthDate), "yyyy-MM-dd");
    const nextEnd = format(endOfMonth(nextMonthDate), "yyyy-MM-dd");
    const horizonEnd = format(addDays(now, 7 * FORECAST_WEEKS), "yyyy-MM-dd");
    const fetchEnd = nextEnd > horizonEnd ? nextEnd : horizonEnd;

    (async () => {
      const [{ data: allProfiles }, scope, { data: company }] = await Promise.all([
        supabase.from("profiles").select("id, name, department_id, manager_id, substitute_id").eq("company_id", profile.company_id).eq("active", true),
        fetchDecisionScope(profile),
        supabase.from("companies").select("work_days, capacity_warning_percent, default_home_office_days").eq("id", profile.company_id).single(),
      ]);
      if (!alive) return;

      const team = ((allProfiles as unknown as TeamMember[]) ?? []).filter((p) => p.id !== profile.id && scope.canDecide(p));
      const teamIds = team.map((p) => p.id);
      const teamSize = team.length;
      if (teamSize === 0) {
        setState({
          teamSize: 0,
          capacityThisMonth: 100,
          capacityNextMonth: 100,
          warnThisMonth: false,
          warnNextMonth: false,
          atRiskCount: 0,
          hoUsedThisMonth: 0,
          hoBudgetThisMonth: null,
          pendingCount: 0,
          oldestWaitDays: 0,
          personRows: [],
          criticalWeeks: [],
          collisionCount: 0,
          balanceRows: [],
        });
        setLoading(false);
        return;
      }

      const workDays = (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const companyThreshold = Number(company?.capacity_warning_percent ?? 30);
      const hoCompanyDefault = Number(company?.default_home_office_days ?? 0);

      const [balances, { data: hoEntitlements }, { data: periodReqs }, { data: forwardReqs }, { data: pendingReqs }] = await Promise.all([
        loadBalances(profile.company_id),
        supabase
          .from("leave_entitlements")
          .select("profile_id, total_days, leave_type:leave_types!inner(key)")
          .eq("year", year)
          .eq("leave_type.key", "home_office")
          .in("profile_id", teamIds),
        supabase
          .from("leave_requests")
          .select("id, profile_id, start_date, end_date, working_days, leave_type:leave_types(key, label, color, counts_as_present)")
          .eq("status", "approved")
          .in("profile_id", teamIds)
          .lte("start_date", range.to)
          .gte("end_date", range.from),
        supabase
          .from("leave_requests")
          .select("id, profile_id, start_date, end_date, working_days, status, leave_type:leave_types(key, counts_as_present)")
          .in("status", ["approved", "pending"])
          .in("profile_id", teamIds)
          .lte("start_date", fetchEnd)
          .gte("end_date", thisStart),
        supabase.from("leave_requests").select("id, created_at").eq("status", "pending").in("profile_id", teamIds),
      ]);
      if (!alive) return;

      type PeriodReq = { id: string; profile_id: string; start_date: string; end_date: string; working_days: number; leave_type: { key: string; label: string; color: LeaveColor; counts_as_present: boolean } | null };
      type ForwardReq = { id: string; profile_id: string; start_date: string; end_date: string; working_days: number; status: string; leave_type: { key: string; counts_as_present: boolean } | null };

      const periodRows = (periodReqs as unknown as PeriodReq[]) ?? [];
      const forwardRows = (forwardReqs as unknown as ForwardReq[]) ?? [];
      const hoOverride = new Map(((hoEntitlements as unknown as { profile_id: string; total_days: number }[]) ?? []).map((e) => [e.profile_id, Number(e.total_days)]));
      const yearlyHoLimit = (id: string) => {
        const v = hoOverride.has(id) ? hoOverride.get(id)! : hoCompanyDefault;
        return v > 0 ? v : null;
      };

      // ---- KPI: kapacita týmu tento/příští měsíc ----
      const approvedReduceDays = (from: string, to: string) =>
        forwardRows.filter((r) => r.status === "approved" && reducesPresence(r.leave_type?.key)).reduce((s, r) => s + daysWithin(r, from, to, workDays), 0);
      const wdThis = countWorkingDays(thisStart, thisEnd, workDays);
      const wdNext = countWorkingDays(nextStart, nextEnd, workDays);
      const capacityThisMonth = wdThis > 0 ? Math.max(0, (1 - approvedReduceDays(thisStart, thisEnd) / (teamSize * wdThis)) * 100) : 100;
      const capacityNextMonth = wdNext > 0 ? Math.max(0, (1 - approvedReduceDays(nextStart, nextEnd) / (teamSize * wdNext)) * 100) : 100;

      // ---- KPI: ohrožené zůstatky dovolené ----
      const atRiskCount = team.filter((p) => remainingOf(balances.get(p.id, "vacation")) > AT_RISK_DAYS).length;

      // ---- KPI: Home Office tento měsíc vůči rozpočtu (roční limit / 12) ----
      const hoUsedThisMonth = forwardRows
        .filter((r) => r.status === "approved" && r.leave_type?.key === "home_office")
        .reduce((s, r) => s + daysWithin(r, thisStart, thisEnd, workDays), 0);
      const limitedMembers = team.filter((p) => yearlyHoLimit(p.id) !== null);
      const hoBudgetThisMonth = limitedMembers.length > 0 ? limitedMembers.reduce((s, p) => s + yearlyHoLimit(p.id)! / 12, 0) : null;

      // ---- KPI: čekající žádosti ----
      const pendingRows = (pendingReqs as unknown as { id: string; created_at: string }[]) ?? [];
      const oldestWaitDays = pendingRows.length > 0 ? Math.max(...pendingRows.map((r) => differenceInCalendarDays(now, parseISO(r.created_at)))) : 0;

      // ---- Srovnání členů týmu (zvolené období nahoře) ----
      const personMap = new Map<string, PersonRow>(team.map((p) => [p.id, { id: p.id, name: p.name, total: 0, byType: [] }]));
      for (const r of periodRows) {
        if (!r.leave_type) continue;
        const row = personMap.get(r.profile_id);
        if (!row) continue;
        const d = daysWithin(r, range.from, range.to, workDays);
        if (d <= 0) continue;
        row.total += d;
        const existing = row.byType.find((t) => t.label === r.leave_type!.label);
        if (existing) existing.days += d;
        else row.byType.push({ label: r.leave_type.label, color: r.leave_type.color, days: d });
      }
      const personRows = Array.from(personMap.values()).sort((a, b) => b.total - a.total);

      // ---- Kritické dny a podstav (kapacitní předpověď na nejbližší týdny) ----
      const heatPeople: InPerson[] = team.map((p) => ({ id: p.id, department_id: p.department_id }));
      const heatDepts: InDept[] = departments.map((d) => ({ id: d.id, name: d.name, capacity_warning_percent: d.capacity_warning_percent }));
      const heatRequests: InRequest[] = forwardRows.map((r) => ({
        profile_id: r.profile_id,
        start_date: r.start_date,
        end_date: r.end_date,
        working_days: r.working_days,
        status: r.status,
        leave_type: r.leave_type ? { key: r.leave_type.key, counts_as_present: r.leave_type.counts_as_present } : null,
      }));
      const heat = capacityHeatmap({ people: heatPeople, depts: heatDepts, requests: heatRequests, from: today, weeks: FORECAST_WEEKS, companyThresholdPct: companyThreshold, workDays });
      const criticalWeeks: CriticalWeek[] = heat
        .flatMap((row) => row.weeks.filter((w) => w.breach).map((w) => ({ weekStart: w.weekStart, dept: row.dept, size: row.size, peakCount: w.peakCount, peakPct: w.peakPct })))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

      // ---- Kolize zastupitelnosti: kdo se v týmu překrývá v nejbližších 30 dnech ----
      const in30 = format(addDays(now, 30), "yyyy-MM-dd");
      const deptOf = new Map(team.map((p) => [p.id, p.department_id]));
      const nearTerm = forwardRows.filter((r) => r.status === "approved" && reducesPresence(r.leave_type?.key) && r.start_date <= in30 && r.end_date >= today);
      const collisionPeople = new Set<string>();
      for (let i = 0; i < nearTerm.length; i++) {
        for (let j = i + 1; j < nearTerm.length; j++) {
          const a = nearTerm[i];
          const b = nearTerm[j];
          if (a.profile_id === b.profile_id) continue;
          const da = deptOf.get(a.profile_id);
          const db = deptOf.get(b.profile_id);
          if (!da || da !== db) continue;
          if (a.start_date <= b.end_date && a.end_date >= b.start_date) {
            collisionPeople.add(a.profile_id);
            collisionPeople.add(b.profile_id);
          }
        }
      }

      // ---- Tabulka zůstatků a čerpání podřízených ----
      const balanceRows: BalanceRow[] = team.map((p) => {
        const vac = balances.get(p.id, "vacation");
        const sick = balances.get(p.id, "sick");
        const hoThisMonthPerson = forwardRows
          .filter((r) => r.profile_id === p.id && r.status === "approved" && r.leave_type?.key === "home_office")
          .reduce((s, r) => s + daysWithin(r, thisStart, thisEnd, workDays), 0);
        return {
          id: p.id,
          name: p.name,
          vacationTotal: vac.total,
          vacationRemaining: remainingOf(vac),
          sickTotal: sick.total,
          sickRemaining: remainingOf(sick),
          hoThisMonth: hoThisMonthPerson,
          hoYearlyLimit: yearlyHoLimit(p.id),
        };
      });

      setState({
        teamSize,
        capacityThisMonth,
        capacityNextMonth,
        warnThisMonth: 100 - capacityThisMonth >= companyThreshold,
        warnNextMonth: 100 - capacityNextMonth >= companyThreshold,
        atRiskCount,
        hoUsedThisMonth,
        hoBudgetThisMonth,
        pendingCount: pendingRows.length,
        oldestWaitDays,
        personRows,
        criticalWeeks,
        collisionCount: collisionPeople.size,
        balanceRows,
      });
      setLoading(false);
    })().catch((e) => console.error("TeamAnalyticsSection failed:", e));

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.company_id, deptIdsKey, range.from, range.to]);

  const insights = useMemo(() => {
    if (!state) return [];
    const out: string[] = [];
    if (state.criticalWeeks.length > 0) {
      const w = state.criticalWeeks[0];
      out.push(`Týden od ${format(parseISO(w.weekStart), "d. M.", { locale: cs })} bude tým na ${formatNumber(100 - w.peakPct)} % kapacity — chybí ${w.peakCount} z ${w.size} lidí.`);
    }
    if (state.collisionCount > 0) out.push(`V nejbližších 30 dnech se překrývá naplánované volno u ${state.collisionCount} ${state.collisionCount === 1 ? "člověka" : "lidí"}.`);
    if (state.atRiskCount > 0) out.push(`${state.atRiskCount} ${state.atRiskCount === 1 ? "člověk má" : "lidí má"} nevyčerpáno víc než ${AT_RISK_DAYS} dní dovolené — hrozí nápor na konci roku.`);
    if (state.hoBudgetThisMonth !== null && state.hoBudgetThisMonth > 0) {
      const pct = Math.round((state.hoUsedThisMonth / state.hoBudgetThisMonth) * 100);
      if (pct >= 90) out.push(`Tým už vyčerpal ${pct} % měsíčního rozpočtu Home Office.`);
    }
    if (state.pendingCount > 0 && state.oldestWaitDays >= 3) out.push(`Nejstarší nevyřízená žádost čeká na rozhodnutí už ${state.oldestWaitDays} ${dayWord(state.oldestWaitDays)}.`);
    if (out.length === 0) out.push("Tým je v pohodě, aktuálně nehrozí žádné riziko k řešení.");
    return out;
  }, [state]);

  async function remind(id: string) {
    setRemindError(null);
    try {
      await sendWellbeingReminder(id);
      setRemindSent((prev) => new Set(prev).add(id));
      showToast("Připomínka odeslána.");
    } catch (e) {
      setRemindError(errorMessage(e));
    }
  }

  if (loading || !state) return <LoadingCard rows={6} className="mt-6" />;

  if (state.teamSize === 0) {
    return <p className="mt-6 text-sm text-muted">Zatím nemáte žádné přímé podřízené ani oddělení, kterému byste byl(a) vedoucí/zástupce.</p>;
  }

  const maxPersonTotal = Math.max(1, ...state.personRows.map((p) => p.total));
  const legendTypes = Array.from(new Map(state.personRows.flatMap((p) => p.byType).map((t) => [t.label, t])).values());
  const multiDept = departments.length > 1;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={cn("card p-5", state.warnThisMonth && "border-warning/50 bg-warning-light/30")} title="Podíl pracovních dnů, kdy je tým přítomen (1 − schválené absence / kapacita)">
          <div className="text-sm text-muted">Kapacita týmu</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className={cn("font-display text-3xl", state.warnThisMonth && "text-warning-dark")}>{formatNumber(Math.round(state.capacityThisMonth))} %</span>
            <span className="text-xs text-muted">tento měsíc</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={cn("font-display text-lg", state.warnNextMonth && "text-warning-dark")}>{formatNumber(Math.round(state.capacityNextMonth))} %</span>
            <span className="text-xs text-muted">příští měsíc</span>
          </div>
        </div>

        <div className={cn("card p-5", state.atRiskCount > 0 && "border-warning/50 bg-warning-light/30")} title={`Lidé s více než ${AT_RISK_DAYS} nevyčerpanými dny dovolené`}>
          <div className="text-sm text-muted">Ohrožené zůstatky dovolené</div>
          <div className="mt-1.5 font-display text-3xl">{state.atRiskCount}</div>
          <div className="mt-1 text-[11px] text-muted">víc než {AT_RISK_DAYS} dní nevyčerpáno</div>
        </div>

        <div className="card p-5" title="Čerpání Home Office tento měsíc vůči součtu ročních limitů / 12">
          <div className="text-sm text-muted">Čerpání Home Office</div>
          <div className="mt-1.5 font-display text-3xl">
            {formatNumber(state.hoUsedThisMonth)} {state.hoBudgetThisMonth !== null && <span className="text-base text-muted">/ {formatNumber(Math.round(state.hoBudgetThisMonth * 10) / 10)}</span>}
          </div>
          <div className="mt-1 text-[11px] text-muted">{state.hoBudgetThisMonth !== null ? `${dayWord(state.hoUsedThisMonth)} tento měsíc` : "bez stanoveného limitu"}</div>
        </div>

        <Link href="/approvals" className={cn("card p-5 transition-colors hover:border-teal/40", state.pendingCount > 0 && "border-warning/50 bg-warning-light/30")}>
          <div className="text-sm text-muted">Čeká na schválení</div>
          <div className="mt-1.5 font-display text-3xl">{state.pendingCount}</div>
          <div className="mt-1 text-[11px] text-muted">{state.oldestWaitDays > 0 ? `nejdéle ${state.oldestWaitDays} ${dayWord(state.oldestWaitDays)}` : "Otevřít Ke schválení →"}</div>
        </Link>
      </div>

      <div className="card p-5">
        <h2 className="flex items-center gap-2 font-display text-h2">
          <Sparkles size={16} className="text-teal-dark" /> Chytré postřehy
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {insights.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-h2">Srovnání členů týmu — {range.label}</h2>
          <p className="mt-1 text-[11px] text-muted">Rozpad absencí podle jednotlivců a typu za zvolené období nahoře. Kliknutím na jméno otevřete detail.</p>
          <div className="mt-4 space-y-3">
            {state.personRows.length === 0 && <p className="text-sm text-muted">Zatím žádná data.</p>}
            {state.personRows.map((p) => (
              <div key={p.id}>
                <button type="button" onClick={() => onOpenDetail({ id: p.id, name: p.name })} className="flex w-full items-center justify-between gap-2 text-left text-sm hover:text-teal-dark">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted">{p.total === 0 ? "beze absence" : `${formatNumber(p.total)} ${dayWord(p.total)}`}</span>
                </button>
                <div className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-paper">
                  {p.byType.map((t) => (
                    <div
                      key={t.label}
                      className={cn("h-full shrink-0", leaveColorBg[t.color])}
                      style={{ width: `${(t.days / maxPersonTotal) * 100}%` }}
                      title={`${t.label}: ${formatNumber(t.days)} ${dayWord(t.days)}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {legendTypes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              {legendTypes.map((t) => (
                <span key={t.label} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-sm", leaveColorBg[t.color])} />
                  {t.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-display text-h2">Kritické dny a podstav</h2>
          <p className="mt-1 text-[11px] text-muted">Týdny v nejbližším měsíci, kdy kvůli naplánovaným absencím klesne přítomnost pod varovnou hranici.</p>
          {state.criticalWeeks.length === 0 ? (
            <p className="mt-4 text-sm text-muted">✓ V nejbližším měsíci nehrozí podkapacita.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {state.criticalWeeks.slice(0, 6).map((w, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded bg-warning-light px-3 py-2 text-warning-dark">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Týden od {format(parseISO(w.weekStart), "d. M.", { locale: cs })}
                    {multiDept ? ` — ${w.dept}` : ""}
                  </span>
                  <span className="font-medium">
                    chybí {w.peakCount} z {w.size} ({w.peakPct} %)
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state.collisionCount > 0 && (
            <p className="mt-3 text-sm text-warning-dark">
              ⚠️ Souběh naplánovaného volna u {state.collisionCount} {state.collisionCount === 1 ? "člověka" : "lidí"} v nejbližších 30 dnech.{" "}
              <Link href="/calendar" className="underline underline-offset-2">
                Otevřít kalendář
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-h2">Zůstatky a čerpání týmu</h2>
          <p className="mt-1 text-[11px] text-muted">Celoroční zůstatky bez ohledu na období zvolené nahoře.</p>
        </div>
        {remindError && <p className="px-5 pt-3 text-xs text-danger-dark">{remindError}</p>}
        <div className="overflow-x-auto">
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Jméno</th>
                <th className="px-3 py-3 font-medium">Dovolená</th>
                <th className="px-3 py-3 font-medium">Sick Days</th>
                <th className="px-3 py-3 font-medium">Home Office (tento měsíc)</th>
                <th className="px-3 py-3 font-medium">Akce</th>
              </tr>
            </thead>
            <tbody>
              {state.balanceRows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="cell-title px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-3 py-2" data-label="Dovolená">
                    <BalanceCell total={r.vacationTotal} remaining={r.vacationRemaining} />
                  </td>
                  <td className="px-3 py-2" data-label="Sick Days">
                    {r.sickTotal > 0 ? <BalanceCell total={r.sickTotal} remaining={r.sickRemaining} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2" data-label="Home Office">
                    {formatNumber(r.hoThisMonth)} {dayWord(r.hoThisMonth)}
                    {r.hoYearlyLimit !== null && <span className="text-muted"> (roční limit {formatNumber(r.hoYearlyLimit)})</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenDetail({ id: r.id, name: r.name })}
                        className="rounded p-1.5 text-muted hover:bg-teal-light hover:text-teal-dark"
                        title="Detail — historie absencí"
                        aria-label="Detail zaměstnance"
                      >
                        <Eye size={15} />
                      </button>
                      {balanceTone(r.vacationRemaining) === "risk" &&
                        (remindSent.has(r.id) ? (
                          <span className="flex items-center gap-1 px-1.5 text-xs text-teal-dark">
                            <Check size={13} /> Odesláno
                          </span>
                        ) : (
                          <button
                            onClick={() => remind(r.id)}
                            className="rounded p-1.5 text-muted hover:bg-warning-light hover:text-warning-dark"
                            title="Poslat přátelskou připomínku k vyčerpání dovolené"
                            aria-label="Poslat připomínku"
                          >
                            <Mail size={15} />
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
