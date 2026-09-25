"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, addYears, endOfMonth, endOfQuarter, endOfYear, format, getISOWeek, getISOWeekYear, getQuarter, parseISO, startOfMonth, startOfQuarter, startOfYear, subMonths, subYears } from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { countWorkingDays, dayWord, formatRange } from "@/lib/working-days";
import { cn, formatNumber } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DbDepartment } from "@/lib/supabase/types";
import { LeaveColor } from "@/lib/supabase/types";
import { ExpiringVacationReport } from "@/components/admin/ExpiringVacationReport";
import { SmartInsights } from "@/components/admin/SmartInsights";
import { reducesPresence } from "@/lib/leave-kinds";

interface State {
  employeeCount: number;
  pendingCount: number;
  absentToday: number;
  monthDays: number;
  byType: { label: string; color: LeaveColor; count: number; days: number }[];
  byDepartment: { name: string; days: number; people: { name: string; days: number }[] }[];
  upcoming: {
    id: string;
    name: string;
    department: string | null;
    start_date: string;
    end_date: string;
    leave_type: { key: string; label: string; color: LeaveColor };
  }[];
}

const colorBg: Record<LeaveColor, string> = {
  teal: "bg-teal",
  rust: "bg-rust",
  moss: "bg-moss",
  violet: "bg-violet",
  amber: "bg-amber",
  sky: "bg-sky",
  plum: "bg-plum",
  sage: "bg-sage",
  gold: "bg-gold",
  wine: "bg-wine",
  slate: "bg-slate",
  forest: "bg-forest",
};

// Czech locative ("v říjnu") for the "Později v …" group headings.
const monthLocative = ["lednu", "únoru", "březnu", "dubnu", "květnu", "červnu", "červenci", "srpnu", "září", "říjnu", "listopadu", "prosinci"];

function weekGroup(startISO: string): string {
  const start = parseISO(startISO);
  const now = new Date();
  const sameWeek = (a: Date, b: Date) => getISOWeekYear(a) === getISOWeekYear(b) && getISOWeek(a) === getISOWeek(b);
  if (sameWeek(start, now)) return "Tento týden";
  if (sameWeek(start, new Date(now.getTime() + 7 * 86400000))) return "Příští týden";
  return `Později v ${monthLocative[start.getMonth()]}`;
}

type Preset = "month" | "lastMonth" | "quarter" | "year" | "custom";

const presetLabels: [Preset, string][] = [
  ["month", "Tento měsíc"],
  ["lastMonth", "Minulý měsíc"],
  ["quarter", "Kvartál"],
  ["year", "Tento rok"],
  ["custom", "Vlastní rozsah"],
];

export function OverviewPanel() {
  const { profile } = useAuth();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState(() => new Date());
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const range = useMemo(() => {
    const now = new Date();
    const iso = (d: Date) => format(d, "yyyy-MM-dd");
    if (preset === "lastMonth") {
      const d = subMonths(now, 1);
      return { from: iso(startOfMonth(d)), to: iso(endOfMonth(d)), label: format(d, "LLLL yyyy", { locale: cs }) };
    }
    if (preset === "quarter") return { from: iso(startOfQuarter(now)), to: iso(endOfQuarter(now)), label: `${getQuarter(now)}. čtvrtletí ${now.getFullYear()}` };
    if (preset === "year") return { from: iso(startOfYear(now)), to: iso(endOfYear(now)), label: String(now.getFullYear()) };
    if (preset === "custom") {
      const from = customFrom <= customTo ? customFrom : customTo;
      const to = customFrom <= customTo ? customTo : customFrom;
      return { from, to, label: `${formatRange(from, to)}` };
    }
    return { from: iso(startOfMonth(anchor)), to: iso(endOfMonth(anchor)), label: format(anchor, "LLLL yyyy", { locale: cs }) };
  }, [preset, anchor, customFrom, customTo]);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState("all");
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  useEffect(() => {
    if (profile) createClient().from("departments").select("*").eq("company_id", profile.company_id).then(({ data }) => setDepartments((data as DbDepartment[]) ?? []));
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toLocaleDateString("sv-SE");
    const monthStart = range.from;
    const monthEnd = range.to;
    const in30 = new Date(Date.now() + 30 * 86400000).toLocaleDateString("sv-SE");

    (async () => {
      const [{ count: employeeCount }, { count: pendingCount }, { data: monthRequests }, { data: upcomingRequests }, { data: todayRequests }] =
        await Promise.all([
          deptFilter === "all"
            ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("active", true)
            : supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", profile.company_id).eq("active", true).eq("department_id", deptFilter),
          // RLS already limits leave_requests to this company — same rows the sidebar badge counts.
          supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabase
            .from("leave_requests")
            .select(
              "working_days, leave_type:leave_types(key, label, color), profile:profiles!leave_requests_profile_id_fkey(id, name, department_id, department:departments!profiles_department_id_fkey(name))"
            )
            .eq("status", "approved")
            .gte("start_date", monthStart)
            .lte("start_date", monthEnd),
          supabase
            .from("leave_requests")
            .select(
              "id, start_date, end_date, leave_type:leave_types(key, label, color), profile:profiles!leave_requests_profile_id_fkey(name, department_id, department:departments!profiles_department_id_fkey(name))"
            )
            .eq("status", "approved")
            .gte("start_date", today)
            .lte("start_date", in30)
            .order("start_date", { ascending: true })
            .limit(30),
          supabase.from("leave_requests").select("profile_id, leave_type:leave_types(key), profile:profiles!leave_requests_profile_id_fkey(department_id)").eq("status", "approved").lte("start_date", today).gte("end_date", today),
        ]);

      type MonthReq = {
        working_days: number;
        leave_type: { key: string; label: string; color: LeaveColor } | null;
        profile: { id: string; name: string; department_id: string | null; department: { name: string } | null } | null;
      };
      const inDept = (id: string | null | undefined) => deptFilter === "all" || id === deptFilter;
      const monthRows = ((monthRequests as unknown as MonthReq[]) ?? []).filter((r) => inDept(r.profile?.department_id));

      const byTypeMap = new Map<string, { label: string; color: LeaveColor; count: number; days: number }>();
      for (const r of monthRows) {
        if (!r.leave_type) continue;
        const cur = byTypeMap.get(r.leave_type.label) ?? { label: r.leave_type.label, color: r.leave_type.color, count: 0, days: 0 };
        cur.count += 1;
        cur.days += Number(r.working_days);
        byTypeMap.set(r.leave_type.label, cur);
      }

      const byDeptMap = new Map<string, { days: number; people: Map<string, number> }>();
      for (const r of monthRows) {
        if (!reducesPresence(r.leave_type?.key)) continue;
        const name = r.profile?.department?.name ?? "Bez oddělení";
        const cur = byDeptMap.get(name) ?? { days: 0, people: new Map<string, number>() };
        cur.days += Number(r.working_days);
        if (r.profile) cur.people.set(r.profile.name, (cur.people.get(r.profile.name) ?? 0) + Number(r.working_days));
        byDeptMap.set(name, cur);
      }

      type UpcomingReq = {
        id: string;
        start_date: string;
        end_date: string;
        leave_type: { key: string; label: string; color: LeaveColor } | null;
        profile: { name: string; department_id: string | null; department: { name: string } | null } | null;
      };

      setState({
        employeeCount: employeeCount ?? 0,
        pendingCount: pendingCount ?? 0,
        absentToday: new Set(
          ((todayRequests as unknown as { profile_id: string; leave_type: { key: string } | null; profile: { department_id: string | null } | null }[]) ?? [])
            .filter((r) => reducesPresence(r.leave_type?.key) && inDept(r.profile?.department_id))
            .map((r) => r.profile_id)
        ).size,
        monthDays: monthRows.filter((r) => reducesPresence(r.leave_type?.key)).reduce((s, r) => s + Number(r.working_days), 0),
        byType: Array.from(byTypeMap.values()).sort((a, b) => b.days - a.days),
        byDepartment: Array.from(byDeptMap.entries())
          .map(([name, v]) => ({
            name,
            days: v.days,
            people: Array.from(v.people.entries())
              .map(([n, days]) => ({ name: n, days }))
              .sort((a, b) => b.days - a.days),
          }))
          .sort((a, b) => b.days - a.days),
        upcoming: ((upcomingRequests as unknown as UpcomingReq[]) ?? [])
          .filter((r) => r.leave_type && r.profile && inDept(r.profile.department_id))
          .map((r) => ({
            id: r.id,
            name: r.profile!.name,
            department: r.profile!.department?.name ?? null,
            start_date: r.start_date,
            end_date: r.end_date,
            leave_type: r.leave_type!,
          })),
      });
      setLoading(false);
    })();
  }, [profile, range.from, range.to, deptFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxDeptDays = Math.max(1, ...(state?.byDepartment.map((d) => d.days) ?? [1]));
  const monthLabel = range.label;

  const kpis = useMemo(() => {
    if (!state) return null;
    const workingDaysInMonth = countWorkingDays(range.from, range.to);
    const capacityDays = state.employeeCount * workingDaysInMonth;
    return {
      avg: state.employeeCount > 0 ? state.monthDays / state.employeeCount : 0,
      presence: capacityDays > 0 ? Math.max(0, (1 - state.monthDays / capacityDays) * 100) : 100,
    };
  }, [state, range.from, range.to]);

  const upcomingGroups = useMemo(() => {
    const groups: { title: string; items: State["upcoming"] }[] = [];
    for (const r of showAllUpcoming ? state?.upcoming ?? [] : (state?.upcoming ?? []).slice(0, 5)) {
      const title = weekGroup(r.start_date);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.items.push(r);
      else groups.push({ title, items: [r] });
    }
    return groups;
  }, [state, showAllUpcoming]);

  const totalTypeDays = state?.byType.reduce((s, t) => s + t.days, 0) ?? 0;

  function exportCsv() {
    if (!state) return;
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [`Přehled;${q(monthLabel)}`, "", "Absence podle typu;Počet;Dny"];
    state.byType.forEach((t) => lines.push(`${q(t.label)};${t.count};${String(t.days).replace(".", ",")}`));
    lines.push("", "Absence podle oddělení;Zaměstnanec;Dny");
    state.byDepartment.forEach((d) => d.people.forEach((p) => lines.push(`${q(d.name)};${q(p.name)};${String(p.days).replace(".", ",")}`)));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prehled-${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Same department, presence-reducing absence, overlapping dates within the upcoming list.
  const overlapCount = (r: State["upcoming"][number]) =>
    r.department && reducesPresence(r.leave_type.key)
      ? new Set(
          (state?.upcoming ?? [])
            .filter((o) => o.id !== r.id && o.department === r.department && o.name !== r.name && reducesPresence(o.leave_type.key) && o.start_date <= r.end_date && o.end_date >= r.start_date)
            .map((o) => o.name)
        ).size
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {presetLabels.map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setPreset(key);
                  if (key === "month") setAnchor(new Date());
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  preset === key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-44 py-1.5 text-xs" aria-label="Filtr podle oddělení">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechna oddělení</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-paper">
              <Download size={13} /> Excel (CSV)
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-xs font-medium hover:bg-paper">
              <Printer size={13} /> PDF (tisk)
            </button>
          </div>
        </div>

        {preset === "custom" ? (
          <div className="no-print mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Od" className="rounded border border-line px-2 py-1.5" />
            <span className="text-muted">–</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="Do" className="rounded border border-line px-2 py-1.5" />
          </div>
        ) : preset === "month" ? (
          <div className="no-print mt-4 flex items-center justify-center gap-2">
            <button onClick={() => setAnchor((d) => subYears(d, 1))} className="rounded p-1.5 hover:bg-paper" aria-label="Předchozí rok">
              <ChevronsLeft size={16} />
            </button>
            <button onClick={() => setAnchor((d) => subMonths(d, 1))} className="rounded p-1.5 hover:bg-paper" aria-label="Předchozí měsíc">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setAnchor(new Date())} className="w-40 text-center font-display text-base capitalize hover:text-teal-dark">
              {monthLabel}
            </button>
            <button onClick={() => setAnchor((d) => addMonths(d, 1))} className="rounded p-1.5 hover:bg-paper" aria-label="Další měsíc">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setAnchor((d) => addYears(d, 1))} className="rounded p-1.5 hover:bg-paper" aria-label="Další rok">
              <ChevronsRight size={16} />
            </button>
          </div>
        ) : (
          <div className="mt-4 text-center font-display text-base capitalize">{monthLabel}</div>
        )}

        {loading || !state || !kpis ? (
          <div className="card mt-6 p-8 text-center text-sm text-muted">Načítám…</div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Link href="/admin/settings" className="card p-5 transition-colors hover:border-teal/40">
                <div className="text-sm text-muted">Zaměstnanci</div>
                <div className="mt-1.5 font-display text-3xl">{state.employeeCount}</div>
                <div className="mt-1 text-[11px] text-muted">Správa uživatelů →</div>
              </Link>
              <Link
                href="/approvals"
                className={cn("card p-5 transition-colors hover:border-teal/40", state.pendingCount > 0 && "border-warning/50 bg-warning-light/30")}
              >
                <div className="text-sm text-muted">Čeká na schválení</div>
                <div className="mt-1.5 font-display text-3xl">{state.pendingCount}</div>
                <div className="mt-1 text-[11px] text-muted">Otevřít Ke schválení →</div>
              </Link>
              <Link href="/calendar?filter=today" className="card p-5 transition-colors hover:border-teal/40">
                <div className="text-sm text-muted">Absence dnes</div>
                <div className="mt-1.5 font-display text-3xl">{state.absentToday}</div>
                <div className="mt-1 text-[11px] text-muted">Zobrazit v kalendáři →</div>
              </Link>
              <div className="card p-5" title="Schválené pracovní dny absence v měsíci / počet zaměstnanců">
                <div className="text-sm text-muted">Průměrná absence</div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl">{formatNumber(Math.round(kpis.avg * 10) / 10)}</span>
                  <span className="text-sm text-muted">{dayWord(Math.round(kpis.avg * 10) / 10)} / zam.</span>
                </div>
                <div className="mt-1 text-[11px] capitalize text-muted">{monthLabel}</div>
              </div>
              <div className="card p-5" title="1 − (dny absence / (zaměstnanci × pracovní dny měsíce))">
                <div className="text-sm text-muted">Kapacita firmy</div>
                <div className="mt-1.5 font-display text-3xl">{formatNumber(Math.round(kpis.presence))} %</div>
                <div className="mt-1 text-[11px] text-muted">přítomnost v měsíci</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="font-display text-h2">Absence podle typu — {monthLabel}</h2>
                {state.byType.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">Za tento měsíc zatím žádné schválené absence.</p>
                ) : (
                  <>
                    <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-paper">
                      {state.byType.map((t) => (
                        <div
                          key={t.label}
                          className={cn("h-full", colorBg[t.color])}
                          style={{ width: `${totalTypeDays > 0 ? (t.days / totalTypeDays) * 100 : 0}%` }}
                          title={`${t.label}: ${formatNumber(t.days)} ${dayWord(t.days)}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {state.byType.map((t) => (
                        <div key={t.label} className="flex items-center gap-2 text-sm">
                          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", colorBg[t.color])} />
                          <span className="flex-1">{t.label}</span>
                          <span className="text-muted">
                            {t.count}× · {formatNumber(t.days)} {dayWord(t.days)}
                            {totalTypeDays > 0 && <> · {Math.round((t.days / totalTypeDays) * 100)} %</>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="card p-5">
                <h2 className="font-display text-h2">Absence podle oddělení</h2>
                <div className="mt-4 space-y-2.5">
                  {state.byDepartment.length === 0 && <p className="text-sm text-muted">Zatím žádná data.</p>}
                  {state.byDepartment.map((d) => (
                    <div key={d.name} className="text-sm">
                      <button
                        onClick={() => setOpenDept((cur) => (cur === d.name ? null : d.name))}
                        className="block w-full text-left"
                        title="Kliknutím zobrazíte, kdo z oddělení čerpal nejvíc"
                      >
                        <div className="flex items-center justify-between">
                          <span>{d.name}</span>
                          <span className="text-muted">
                            {formatNumber(d.days)} {dayWord(d.days)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-paper">
                          <div className="h-full rounded-full bg-teal" style={{ width: `${(d.days / maxDeptDays) * 100}%` }} />
                        </div>
                      </button>
                      {openDept === d.name && (
                        <ul className="mt-2 space-y-1 rounded bg-paper px-3 py-2 text-xs">
                          {d.people.map((p) => (
                            <li key={p.name} className="flex justify-between">
                              <span>{p.name}</span>
                              <span className="text-muted">
                                {formatNumber(p.days)} {dayWord(p.days)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Not scoped to the month/year switcher above — always "starting from today", so it's pulled visually apart with its own heading + divider rather than sitting right under the monthly cards. */}
      {state && (
        <div className="space-y-6">
          <SmartInsights departmentId={deptFilter} />

          <h2 className="mb-3 text-label uppercase tracking-wide text-muted">Nezávisle na vybraném období</h2>
          <div className="card overflow-hidden">
            <div className="border-b border-line p-5">
              <h2 className="font-display text-h2">Nadcházejících 30 dní</h2>
              <p className="mt-0.5 text-xs text-muted">Vždy od dneška, bez ohledu na zvolené období výše.</p>
            </div>
            {state.upcoming.length === 0 ? (
              <div className="p-5 text-sm text-muted">V dalších 30 dnech nikdo nemá naplánované volno.</div>
            ) : (
              <div className={cn(showAllUpcoming && "max-h-[380px] overflow-y-auto")}>
                {upcomingGroups.map((g) => (
                  <div key={g.title}>
                    <div className="border-b border-line bg-paper px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{g.title}</div>
                    <div className="divide-y divide-line">
                      {g.items.map((r) => (
                        <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{r.name}</span>
                              {overlapCount(r) > 0 && (
                                <span
                                  className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning-dark"
                                  title={`Ve stejném termínu chybí dalších ${overlapCount(r)} z oddělení ${r.department}`}
                                >
                                  ⚠️ Souběh v týmu
                                </span>
                              )}
                            </div>
                            {r.department && <div className="text-xs text-muted">{r.department}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <LeaveBadge type={r.leave_type} />
                            <span className="text-muted">{formatRange(r.start_date, r.end_date)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {state.upcoming.length > 5 && (
              <button onClick={() => setShowAllUpcoming((v) => !v)} className="w-full border-t border-line py-2 text-sm font-medium text-teal-dark hover:bg-paper">
                {showAllUpcoming ? "Zobrazit méně" : `Zobrazit všech ${state.upcoming.length} absencí`}
              </button>
            )}
          </div>

          <ExpiringVacationReport departmentId={deptFilter} />
        </div>
      )}
    </div>
  );
}
