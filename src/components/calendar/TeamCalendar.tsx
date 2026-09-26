"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isWeekend,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { CalendarFilter, CalendarViewMode } from "./CalendarFilter";
import { ICalExportBox } from "./ICalExportBox";
import { czechHolidayName, dayWord, formatRange, isCzechHoliday } from "@/lib/working-days";
import { cn, formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useOnDataChanged } from "@/lib/events";
import { useSearchParams } from "next/navigation";
import { ABSENT_TYPE, reducesPresence } from "@/lib/leave-kinds";
import { fetchMaskedAbsencesStrict } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { DbDepartment, DbProfile, LeaveColor } from "@/lib/supabase/types";
import { fetchAll } from "@/lib/fetch-all";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { BookForEmployeeModal } from "@/components/manager/BookForEmployeeModal";
import { leaveIconFor, LeaveTypeIcon } from "@/components/shared/LeaveTypeIcon";

const colorDot: Record<LeaveColor, string> = {
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

// Pending bars: same type color (so it still matches the legend / Typy absencí),
// but lighter and hatched — solid = approved, hatched = waiting for approval.
const hatch = "[background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.6)_0_4px,transparent_4px_8px)]";

interface RequestRow {
  id: string;
  start_date: string;
  end_date: string;
  profile_id: string;
  covering_profile_id: string | null;
  working_days: number;
  note: string | null;
  status: "approved" | "pending";
  leave_type: { key: string; label: string; color: LeaveColor };
}

interface LegendType {
  key: string;
  label: string;
  color: LeaveColor;
}

export function TeamCalendar() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("hledat") ?? "");
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => (typeof window !== "undefined" && window.innerWidth < 640 ? "week" : "month"));
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<DbProfile[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [leaveTypesLegend, setLeaveTypesLegend] = useState<LegendType[]>([]);
  const [weekendOperations, setWeekendOperations] = useState(true);
  const [onlyAbsentToday, setOnlyAbsentToday] = useState(searchParams.get("filter") === "today");
  // Seskupení podle oddělení je výchozí: hned je vidět, jestli v týmu nechybí všichni najednou.
  const [groupByDept, setGroupByDept] = useState(true);
  const [marksOpen, setMarksOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<{ x: number; y: number; req: RequestRow; name: string; all?: RequestRow[] } | null>(null);
  // A tap anywhere closes the detail opened by a previous tap (touch has no mouseleave).
  useEffect(() => {
    if (!hover) return;
    const close = () => setHover(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [hover !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const [anchor, setAnchor] = useState(() => new Date());
  const today = new Date();

  const allDays =
    viewMode === "day"
      ? [startOfDay(anchor)]
      : viewMode === "month"
      ? eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) })
      : viewMode === "2weeks"
        ? eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn: 1 }), end: addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 13) })
        : eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn: 1 }), end: addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 6) });
  // Weekend columns always stay in the grid (removing them made weeks blend
  // together and read as illogical) — weekendOperations instead controls
  // whether an absence bar visually covers the weekend days in its range,
  // see the segment-splitting in the bar renderer below.
  const days = allDays;

  const periodLabel =
    viewMode === "day"
      ? [format(anchor, "EEEE d. LLLL yyyy", { locale: cs }), czechHolidayName(anchor)].filter(Boolean).join(" — ")
      : viewMode === "month"
      ? format(anchor, "LLLL yyyy", { locale: cs })
      : `${format(days[0] ?? anchor, "d. M.")} – ${format(days[days.length - 1] ?? anchor, "d. M. yyyy")}`;

  // Keyboard: ← → move by the current period, T = today, D / W / 2 / M = day / week / 2 weeks / month.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft") goPrev();
      else if (k === "arrowright") goNext();
      else if (k === "t") setAnchor(new Date());
      else if (k === "d") setViewMode("day");
      else if (k === "m") setViewMode("month");
      else if (k === "2") setViewMode("2weeks");
      else if (k === "w") setViewMode("week");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  function goPrev() {
    setAnchor((d) => (viewMode === "day" ? subDays(d, 1) : viewMode === "month" ? subMonths(d, 1) : viewMode === "2weeks" ? subWeeks(d, 2) : subWeeks(d, 1)));
  }
  function goNext() {
    setAnchor((d) => (viewMode === "day" ? addDays(d, 1) : viewMode === "month" ? addMonths(d, 1) : viewMode === "2weeks" ? addWeeks(d, 2) : addWeeks(d, 1)));
  }

  // Drag-select on the viewer's own row to request leave for that range.
  const [dragging, setDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const dragEmpRef = useRef<string | null>(null);
  const [requestDates, setRequestDates] = useState<{ start: string; end: string; empId: string | null } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function finish() {
      setDragging(false);
      setDragStartIdx((startIdx) => {
        setDragEndIdx((endIdx) => {
          if (startIdx !== null && endIdx !== null) {
            const lo = Math.min(startIdx, endIdx);
            const hi = Math.max(startIdx, endIdx);
            setRequestDates({ start: format(days[lo], "yyyy-MM-dd"), end: format(days[hi], "yyyy-MM-dd"), empId: dragEmpRef.current });
          }
          return null;
        });
        return null;
      });
    }
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  // Only the requests around the shown period are loaded (±2 months), so the calendar stays fast as history grows.
  const monthKey = format(anchor, "yyyy-MM");
  const [loadFailed, setLoadFailed] = useState(false);
  function loadRequests() {
    if (!profile) return;
    const from = format(startOfMonth(subMonths(anchor, 2)), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(anchor, 2)), "yyyy-MM-dd");
    Promise.all([
      fetchAll<RequestRow>((a, b) =>
        createClient()
          .from("leave_requests")
          .select("id, start_date, end_date, profile_id, covering_profile_id, working_days, note, status, leave_type:leave_types(key, label, color)")
          .in("status", ["approved", "pending"])
          .lte("start_date", to)
          .gte("end_date", from)
          .order("id")
          .range(a, b) as unknown as PromiseLike<{ data: RequestRow[] | null; error: { message: string } | null }>
      ),
      fetchMaskedAbsencesStrict(from, to).then(
        (m) => ({ masked: m, failed: false }),
        () => ({ masked: [] as Awaited<ReturnType<typeof fetchMaskedAbsencesStrict>>, failed: true })
      ),
    ]).then(([{ data, error }, { masked, failed }]) => {
      // Private absences (e.g. sick leave) of colleagues arrive without a type — shown as "Nepřítomen".
      const hidden: RequestRow[] = masked.map((m) => ({ ...m, covering_profile_id: null, note: null, leave_type: ABSENT_TYPE }));
      setRequests([...((data as unknown as RequestRow[]) ?? []), ...hidden]);
      setLoadFailed(!!error || failed);
    });
  }

  useOnDataChanged(loadRequests);
  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, monthKey]);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    supabase.from("departments").select("*").eq("company_id", profile.company_id).then(({ data }) => setDepartments(data ?? []));
    supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id).eq("active", true).then(({ data }) => setEmployees((data as unknown as DbProfile[]) ?? []));
    supabase
      .from("leave_types")
      .select("key, label, color")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .then(({ data }) => setLeaveTypesLegend(data ?? []));
    supabase
      .from("companies")
      .select("weekend_operations")
      .eq("id", profile.company_id)
      .single()
      .then(({ data }) => setWeekendOperations(data?.weekend_operations ?? true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const todayIso = new Date().toLocaleDateString("sv-SE");
  const absentTodayIds = new Set(
    requests.filter((r) => r.status === "approved" && r.start_date <= todayIso && r.end_date >= todayIso && reducesPresence(r.leave_type.key)).map((r) => r.profile_id)
  );

  const filtered = employees
    .filter((e) => !onlyAbsentToday || absentTodayIds.has(e.id) || e.id === profile?.id)
    .filter((e) => department === "all" || e.department_id === department)
    .filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((e) => leaveTypeFilter === "all" || requests.some((r) => r.profile_id === e.id && r.leave_type.key === leaveTypeFilter));

  // The viewer's own row is pinned to the top, separated from the team below.
  const ownRow = filtered.find((e) => e.id === profile?.id);
  const others = filtered.filter((e) => e.id !== profile?.id).sort((a, b) => a.name.localeCompare(b.name, "cs"));

  const groups = groupByDept
    ? [...departments.map((d) => ({ id: d.id, name: d.name, color: d.color, members: others.filter((e) => e.department_id === d.id) })), { id: "none", name: "Bez oddělení", color: "slate" as LeaveColor, members: others.filter((e) => !e.department_id || !departments.some((d) => d.id === e.department_id)) }].filter((g) => g.members.length > 0)
    : [];

  function toggleGroup(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Every request of the person that covers this day (they can overlap, e.g. an approved vacation and a pending sick day).
  function reqsCovering(empId: string, iso: string) {
    return requests.filter(
      (r) => r.profile_id === empId && r.start_date <= iso && r.end_date >= iso && (leaveTypeFilter === "all" || r.leave_type.key === leaveTypeFilter)
    );
  }

  function renderRow(emp: DbProfile, i: number, pinned = false) {
    const dept = departments.find((d) => d.id === emp.department_id);
    const empRequests = requests.filter((r) => r.profile_id === emp.id && (leaveTypeFilter === "all" || r.leave_type.key === leaveTypeFilter));
    const isOwnRow = emp.id === profile?.id;
    // Tažením myší přes dny se dá založit žádost: vlastní řádek = moje žádost, cizí řádek (manažer, admin) = absence za zaměstnance.
    const canDrag = isOwnRow || profile?.role === "admin" || profile?.role === "manager";
    // Úseky, které žádost zabírá v zobrazeném období. Bez provozu o víkendu se pruh nekreslí přes sobotu a neděli,
    // takže se rozdělí na souvislé běhy pracovních dní.
    const segmentsOf = (r: RequestRow): [number, number][] => {
      const startIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.start_date);
      const endIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.end_date);
      if (startIdx === -1 || endIdx === -1) return [];
      if (weekendOperations) return [[startIdx, endIdx]];
      const runs: [number, number][] = [];
      let segStart: number | null = null;
      for (let i2 = startIdx; i2 <= endIdx; i2++) {
        if (!isWeekend(days[i2])) {
          if (segStart === null) segStart = i2;
        } else if (segStart !== null) {
          runs.push([segStart, i2 - 1]);
          segStart = null;
        }
      }
      if (segStart !== null) runs.push([segStart, endIdx]);
      return runs;
    };
    const rowBg = pinned ? "bg-teal-light" : i % 2 === 1 ? "bg-paper" : "bg-white";

    return (
      <div key={emp.id} className={cn("grid grid-cols-[104px_1fr] sm:grid-cols-[200px_1fr] items-center py-2", rowBg, pinned ? "sticky top-[52px] z-20 border-b-2 border-line shadow-sm" : "border-b border-line last:border-0")}>
        <div className={cn("sticky left-0 z-10 py-1 pl-1 pr-3", rowBg)}>
          <div className="text-xs font-medium sm:text-sm">
            {emp.name}
            {isOwnRow && <span className="ml-1.5 text-xs text-teal-dark">(vy)</span>}
          </div>
          {dept && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colorDot[dept.color])} />
              {dept.name}
            </div>
          )}
        </div>
        <div
          className={cn("relative grid h-7 select-none", canDrag && "cursor-crosshair")}
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}
          title={canDrag ? (isOwnRow ? "Přetažením vyberte termín žádosti o absenci" : `Přetažením zadáte absenci za: ${emp.name}`) : undefined}
          onMouseLeave={() => setHover(null)}
        >
          {days.map((d, di) => {
            const inDrag =
              canDrag &&
              dragging &&
              dragEmpRef.current === emp.id &&
              dragStartIdx !== null &&
              dragEndIdx !== null &&
              di >= Math.min(dragStartIdx, dragEndIdx) &&
              di <= Math.max(dragStartIdx, dragEndIdx);
            const isToday = isSameDay(d, today);
            const holidayName = czechHolidayName(d);
            const cellTitle = canDrag ? undefined : holidayName ?? (isWeekend(d) ? "Víkend" : isToday ? "Dnes" : undefined);
            return (
              <div
                key={d.toISOString()}
                title={cellTitle}
                onMouseDown={
                  canDrag
                    ? () => {
                        setHover(null);
                        dragEmpRef.current = emp.id;
                        setDragging(true);
                        setDragStartIdx(di);
                        setDragEndIdx(di);
                      }
                    : undefined
                }
                onMouseEnter={
                  canDrag
                    ? (e) => {
                        if (dragging) {
                          if (dragEmpRef.current === emp.id) setDragEndIdx(di);
                          return;
                        }
                        const all = reqsCovering(emp.id, format(d, "yyyy-MM-dd"));
                        setHover(all.length ? { x: e.clientX, y: e.clientY, req: all[all.length - 1], name: emp.name, all } : null);
                      }
                    : undefined
                }
                className={cn(
                  "h-full border-x border-transparent",
                  isCzechHoliday(d) ? "border-warning/40 bg-warning/25" : isWeekend(d) && "bg-ink/[0.07]",
                  isToday && "border-sky/60 bg-sky/10",
                  inDrag && "bg-teal/30"
                )}
              />
            );
          })}
          {empRequests.map((r) => {
            const segments = segmentsOf(r);
            // Dvě žádosti stejného druhu a stavu ve dnech těsně po sobě se kreslí jako jeden pruh (každá zůstává samostatnou
            // žádostí a ukáže vlastní detail). Mezera mezi nimi by vypadala jako přerušení absence.
            const sameKind = (o: RequestRow) => o.id !== r.id && o.leave_type.key === r.leave_type.key && o.status === r.status;
            return segments.map(([segStart, segEnd]) => {
              const joinLeft = empRequests.some((o) => sameKind(o) && segmentsOf(o).some(([, e2]) => e2 === segStart - 1));
              const joinRight = empRequests.some((o) => sameKind(o) && segmentsOf(o).some(([s2]) => s2 === segEnd + 1));
              return (
              <div
                key={`${r.id}-${segStart}`}
                tabIndex={0}
                role="img"
                aria-label={`${emp.name}: ${r.leave_type.label}, ${formatRange(r.start_date, r.end_date)}, ${r.status === "approved" ? "schváleno" : "čeká na schválení"}`}
                onFocus={(e) => {
                  const b = e.currentTarget.getBoundingClientRect();
                  setHover({ x: b.left, y: b.bottom - 14, req: r, name: emp.name });
                }}
                onBlur={() => setHover(null)}
                onClick={(e) => {
                  // Touch screens have no hover — a tap opens the same detail.
                  const b = e.currentTarget.getBoundingClientRect();
                  setHover({ x: b.left, y: b.bottom - 14, req: r, name: emp.name });
                }}
                onMouseMove={canDrag ? undefined : (e) => setHover({ x: e.clientX, y: e.clientY, req: r, name: emp.name })}
                onMouseLeave={canDrag ? undefined : () => setHover(null)}
                className={cn(
                  "absolute top-0.5 h-6 rounded-sm focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-ink",
                  // On the viewer's own row this must never swallow the mousedown
                  // that starts a drag-select — hover there is handled by the cells.
                  canDrag && "pointer-events-none",
                  colorDot[r.leave_type.color],
                  r.status === "pending" ? cn("opacity-70 ring-1 ring-inset ring-white/70", hatch) : "opacity-90 hover:opacity-100"
                )}
                style={{
                  left: `calc(${(segStart / days.length) * 100}% + ${joinLeft ? 0 : 2}px)`,
                  width: `calc(${((segEnd - segStart + 1) / days.length) * 100}% - ${(joinLeft ? 0 : 2) + (joinRight ? 0 : 2)}px)`,
                  ...(joinLeft ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : {}),
                  ...(joinRight ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}),
                }}
              >
                {(viewMode === "day" || viewMode === "week") && (
                  <span className="block truncate px-2 text-[11px] leading-6 text-white">
                    {r.leave_type.label}
                    {r.status === "pending" ? " (čeká)" : ""}
                  </span>
                )}
              </div>
              );
            });
          })}
        </div>
      </div>
    );
  }


  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={groupByDept} onChange={(e) => setGroupByDept(e.target.checked)} className="h-3.5 w-3.5" />
          Seskupit podle oddělení
        </label>
        <ICalExportBox />
      </div>
      {loadFailed && (
        <div className="mb-3 flex items-center gap-2 rounded border border-warning/40 bg-warning-light px-3 py-2 text-sm text-warning-dark" role="alert">
          Kalendář se nepodařilo načíst celý — některé absence mohou chybět.
          <button onClick={() => loadRequests()} className="ml-auto text-xs underline">
            Zkusit znovu
          </button>
        </div>
      )}
      {onlyAbsentToday && (
        <div className="mb-3 flex items-center gap-2 rounded bg-teal-light px-3 py-2 text-sm text-teal-dark">
          Zobrazuji jen lidi s absencí dnes ({absentTodayIds.size}).
          <button onClick={() => setOnlyAbsentToday(false)} className="ml-auto text-xs underline">
            Zrušit filtr
          </button>
        </div>
      )}
      <CalendarFilter
        department={department}
        onDepartmentChange={setDepartment}
        departments={departments}
        leaveTypeFilter={leaveTypeFilter}
        onLeaveTypeFilterChange={setLeaveTypeFilter}
        leaveTypes={leaveTypesLegend}
        search={search}
        onSearchChange={setSearch}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        periodLabel={periodLabel}
        onPrev={goPrev}
        onNext={goNext}
        onToday={() => setAnchor(new Date())}
      />

      {leaveTypesLegend.length > 0 && (
        <button onClick={() => setLegendOpen((v) => !v)} aria-expanded={legendOpen} className="mt-4 text-xs text-muted underline sm:hidden">
          {legendOpen ? "Skrýt legendu" : "Zobrazit legendu"}
        </button>
      )}
      {leaveTypesLegend.length > 0 && (
        <div className={cn("relative mt-2 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted sm:mt-3 sm:flex", legendOpen ? "flex" : "hidden")}>
          <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            {leaveTypesLegend.map((t) => {
              const icon = leaveIconFor(t.key);
              return (
                <span key={t.key} className="flex items-center gap-1.5" title={`${t.label} — barva tohoto typu v kalendáři`}>
                  {icon ? <LeaveTypeIcon name={icon} size={13} /> : null}
                  <span className={cn("h-2.5 w-2.5 rounded-sm", colorDot[t.color])} />
                  {t.label}
                </span>
              );
            })}
            <span className="flex items-center gap-1.5" title="U soukromých absencí (např. nemoc) kolegové důvod nevidí">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate" /> Nepřítomen
            </span>
          </span>
          <button type="button" onClick={() => setMarksOpen((v) => !v)} aria-expanded={marksOpen} aria-label="Vysvětlivky značek" title="Vysvětlivky značek" className="rounded p-0.5 hover:bg-paper hover:text-ink">
            <HelpCircle size={14} />
          </button>
          {marksOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-64 space-y-1.5 rounded-lg border border-line bg-white p-3 shadow-[0_8px_30px_rgba(22,35,59,0.12)]" role="dialog" aria-label="Značky v kalendáři">
              <div className="flex items-center gap-2"><span className={cn("h-2.5 w-6 shrink-0 rounded-sm bg-ink/50", hatch)} /> Šrafování = čeká na schválení</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-6 shrink-0 rounded-sm bg-warning/60" /> Státní svátek</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-6 shrink-0 rounded-sm border-x-2 border-sky bg-sky/20" /> Dnešní den (modrý sloupec)</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-6 shrink-0 rounded-sm bg-ink/10" /> Víkend</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 max-h-[70vh] overflow-auto">
        <div className="min-w-[var(--cal-min)] sm:min-w-[900px]" style={{ "--cal-min": `${104 + days.length * 30}px` } as React.CSSProperties}>
          <div className="sticky top-0 z-20 grid h-[52px] grid-cols-[104px_1fr] bg-white sm:grid-cols-[200px_1fr]">
            <div className="sticky left-0 z-30 bg-white" />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}>
              {days.map((d) => {
                const holidayName = czechHolidayName(d);
                const isToday = isSameDay(d, today);
                const dayTitle = holidayName ?? (isToday ? "Dnešní datum" : isWeekend(d) ? "Víkend" : undefined);
                return (
                  <div
                    key={d.toISOString()}
                    title={dayTitle}
                    className={cn(
                      "rounded-t-sm border-b-2 pb-1.5 text-center text-xs",
                      isToday ? "border-sky-dark" : "border-line",
                      holidayName ? "bg-warning-light text-warning-dark" : isToday ? "bg-sky-light" : isWeekend(d) ? "bg-ink/[0.09] text-ink/70" : "bg-white"
                    )}
                  >
                    <div className={cn("pt-0.5 leading-tight", isToday ? "text-[10px] font-bold uppercase text-sky-dark" : "text-muted")}>{isToday ? "Dnes" : format(d, "EEEEEE", { locale: cs })}</div>
                    <div className={cn("text-sm font-medium leading-tight", isToday && "font-bold text-sky-dark")}>{format(d, "d")}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {ownRow && renderRow(ownRow, 0, true)}

          {groupByDept
            ? groups.map((g) => {
                const isCollapsed = collapsed.has(g.id);
                return (
                  <Fragment key={g.id}>
                    <div className="grid grid-cols-[104px_1fr] border-b border-line bg-paper sm:grid-cols-[200px_1fr]">
                      <button
                        onClick={() => toggleGroup(g.id)}
                        aria-expanded={!isCollapsed}
                        className="sticky left-0 z-10 flex items-center gap-2 bg-paper px-2 py-1.5 text-left text-sm font-medium hover:bg-line/40"
                      >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", colorDot[g.color])} />
                        <span className="truncate">
                          {g.name} ({g.members.length})
                        </span>
                      </button>
                      <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }} aria-label={`Dostupnost oddělení ${g.name} po dnech`}>
                        {days.map((d) => {
                          const iso = format(d, "yyyy-MM-dd");
                          const size = g.members.length;
                          const away = new Set(requests.filter((r) => r.status === "approved" && reducesPresence(r.leave_type.key) && r.start_date <= iso && r.end_date >= iso && g.members.some((m) => m.id === r.profile_id)).map((r) => r.profile_id)).size;
                          const nonWork = isWeekend(d) || isCzechHoliday(d);
                          const ratio = size > 0 ? away / size : 0;
                          return (
                            <div
                              key={iso}
                              title={nonWork ? undefined : `${g.name}: chybí ${away} z ${size}`}
                              className={cn("flex h-6 items-center justify-center text-[10px] font-medium", nonWork ? "text-transparent" : away === 0 ? "text-muted/50" : ratio >= 0.5 ? "bg-danger-light text-danger-dark" : ratio >= 0.25 ? "bg-warning-light text-warning-dark" : "bg-paper text-ink")}
                            >
                              {nonWork ? "" : away > 0 ? away : "·"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {!isCollapsed && g.members.map((e, i) => renderRow(e, i))}
                  </Fragment>
                );
              })
            : others.map((e, i) => renderRow(e, i))}

          {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted">Nikdo neodpovídá zvolenému filtru.</div>}
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 w-64 rounded-lg border border-line bg-white p-3 text-sm shadow-[0_8px_30px_rgba(22,35,59,0.16)]"
          style={{ left: Math.min(hover.x + 14, window.innerWidth - 280), top: hover.y + 14 }}
        >
          <div className="text-xs text-muted">{hover.name}</div>
          {(hover.all && hover.all.length > 1 ? hover.all : [hover.req]).map((r, idx) => {
            const cover = r.covering_profile_id ? employees.find((e) => e.id === r.covering_profile_id) : undefined;
            return (
              <div key={r.id} className={cn(idx > 0 || (hover.all && hover.all.length > 1) ? "mt-2 border-t border-line pt-2" : "mt-0.5")}>
                <div className="font-medium">
                  {r.leave_type.label} <span className="font-normal text-muted">({r.status === "approved" ? "Schváleno" : "Čeká na schválení"})</span>
                </div>
                <div className="mt-1 text-xs">
                  📅 {formatRange(r.start_date, r.end_date)} ({formatNumber(Number(r.working_days))} {dayWord(Number(r.working_days))})
                </div>
                {r.note && <div className="mt-1 text-xs">💬 {r.note}</div>}
                {cover && <div className="mt-1 text-xs">🔄 Zástup: {cover.name}</div>}
              </div>
            );
          })}
        </div>
      )}

      {requestDates && requestDates.empId && requestDates.empId !== profile?.id && (
        <BookForEmployeeModal
          hideTrigger
          open
          onOpenChange={(o) => !o && setRequestDates(null)}
          presetEmployeeId={requestDates.empId}
          initialDates={{ start: requestDates.start, end: requestDates.end }}
          onSaved={() => {
            setRequestDates(null);
            loadRequests();
          }}
        />
      )}
      {requestDates && (!requestDates.empId || requestDates.empId === profile?.id) && (
        <RequestLeaveModal
          trigger={null}
          open={!!requestDates}
          onOpenChange={(o) => !o && setRequestDates(null)}
          initialDates={{ start: requestDates.start, end: requestDates.end }}
          onSaved={() => {
            setRequestDates(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
