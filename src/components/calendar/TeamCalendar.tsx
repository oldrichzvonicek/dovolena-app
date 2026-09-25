"use client";

import { Fragment, useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isWeekend,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { cs } from "date-fns/locale";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CalendarFilter, CalendarViewMode } from "./CalendarFilter";
import { ICalExportBox } from "./ICalExportBox";
import { czechHolidayName, dayWord, formatRange, isCzechHoliday } from "@/lib/working-days";
import { cn, formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useOnDataChanged } from "@/lib/events";
import { useSearchParams } from "next/navigation";
import { ABSENT_TYPE, reducesPresence } from "@/lib/leave-kinds";
import { fetchMaskedAbsences } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import { DbDepartment, DbProfile, LeaveColor } from "@/lib/supabase/types";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
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
  const [groupByDept, setGroupByDept] = useState(false);
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
    viewMode === "month"
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
    viewMode === "month"
      ? format(anchor, "LLLL yyyy", { locale: cs })
      : `${format(days[0] ?? anchor, "d. M.")} – ${format(days[days.length - 1] ?? anchor, "d. M. yyyy")}`;

  // Keyboard: ← → move by the current period, T = today, M / 2 / W = month / 2 weeks / week.
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
    setAnchor((d) => (viewMode === "month" ? subMonths(d, 1) : viewMode === "2weeks" ? subWeeks(d, 2) : subWeeks(d, 1)));
  }
  function goNext() {
    setAnchor((d) => (viewMode === "month" ? addMonths(d, 1) : viewMode === "2weeks" ? addWeeks(d, 2) : addWeeks(d, 1)));
  }

  // Drag-select on the viewer's own row to request leave for that range.
  const [dragging, setDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [requestDates, setRequestDates] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function finish() {
      setDragging(false);
      setDragStartIdx((startIdx) => {
        setDragEndIdx((endIdx) => {
          if (startIdx !== null && endIdx !== null) {
            const lo = Math.min(startIdx, endIdx);
            const hi = Math.max(startIdx, endIdx);
            setRequestDates({ start: format(days[lo], "yyyy-MM-dd"), end: format(days[hi], "yyyy-MM-dd") });
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

  function loadRequests() {
    if (!profile) return;
    Promise.all([
      createClient()
        .from("leave_requests")
        .select("id, start_date, end_date, profile_id, covering_profile_id, working_days, note, status, leave_type:leave_types(key, label, color)")
        .in("status", ["approved", "pending"]),
      fetchMaskedAbsences(),
    ]).then(([{ data }, masked]) => {
      // Private absences (e.g. sick leave) of colleagues arrive without a type — shown as "Nepřítomen".
      const hidden: RequestRow[] = masked.map((m) => ({ ...m, covering_profile_id: null, note: null, leave_type: ABSENT_TYPE }));
      setRequests([...((data as unknown as RequestRow[]) ?? []), ...hidden]);
    });
  }

  useOnDataChanged(loadRequests);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    supabase.from("departments").select("*").eq("company_id", profile.company_id).then(({ data }) => setDepartments(data ?? []));
    supabase.from("profiles").select("*").eq("company_id", profile.company_id).eq("active", true).then(({ data }) => setEmployees(data ?? []));
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
    loadRequests();
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
          className={cn("relative grid h-7 select-none", isOwnRow && "cursor-crosshair")}
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}
          title={isOwnRow ? "Přetažením vyberte termín žádosti o absenci" : undefined}
          onMouseLeave={() => setHover(null)}
        >
          {days.map((d, di) => {
            const inDrag =
              isOwnRow &&
              dragging &&
              dragStartIdx !== null &&
              dragEndIdx !== null &&
              di >= Math.min(dragStartIdx, dragEndIdx) &&
              di <= Math.max(dragStartIdx, dragEndIdx);
            const isToday = isSameDay(d, today);
            const holidayName = czechHolidayName(d);
            const cellTitle = isOwnRow ? undefined : holidayName ?? (isWeekend(d) ? "Víkend" : isToday ? "Dnes" : undefined);
            return (
              <div
                key={d.toISOString()}
                title={cellTitle}
                onMouseDown={
                  isOwnRow
                    ? () => {
                        setHover(null);
                        setDragging(true);
                        setDragStartIdx(di);
                        setDragEndIdx(di);
                      }
                    : undefined
                }
                onMouseEnter={
                  isOwnRow
                    ? (e) => {
                        if (dragging) {
                          setDragEndIdx(di);
                          return;
                        }
                        const all = reqsCovering(emp.id, format(d, "yyyy-MM-dd"));
                        setHover(all.length ? { x: e.clientX, y: e.clientY, req: all[all.length - 1], name: emp.name, all } : null);
                      }
                    : undefined
                }
                className={cn(
                  "h-full border-x border-transparent",
                  isCzechHoliday(d) ? "bg-warning-light/60" : isWeekend(d) && "bg-paper",
                  isToday && "bg-teal/10",
                  inDrag && "bg-teal/30"
                )}
              />
            );
          })}
          {empRequests.map((r) => {
            const startIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.start_date);
            const endIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.end_date);
            if (startIdx === -1 || endIdx === -1) return null;

            // Without weekend operations, a multi-day bar shouldn't
            // paint over Sat/Sun in the middle of its range — split
            // it into one segment per contiguous run of workdays.
            const segments = weekendOperations
              ? [[startIdx, endIdx]]
              : (() => {
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
                })();

            return segments.map(([segStart, segEnd]) => (
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
                onMouseMove={isOwnRow ? undefined : (e) => setHover({ x: e.clientX, y: e.clientY, req: r, name: emp.name })}
                onMouseLeave={isOwnRow ? undefined : () => setHover(null)}
                className={cn(
                  "absolute top-0.5 h-6 rounded-sm focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-ink",
                  // On the viewer's own row this must never swallow the mousedown
                  // that starts a drag-select — hover there is handled by the cells.
                  isOwnRow && "pointer-events-none",
                  colorDot[r.leave_type.color],
                  r.status === "pending" ? cn("opacity-70 ring-1 ring-inset ring-white/70", hatch) : "opacity-90 hover:opacity-100"
                )}
                style={{
                  left: `calc(${(segStart / days.length) * 100}% + 2px)`,
                  width: `calc(${((segEnd - segStart + 1) / days.length) * 100}% - 4px)`,
                }}
              />
            ));
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
        <div className={cn("mt-2 flex-wrap gap-4 rounded border border-line bg-paper px-4 py-2.5 text-xs text-muted sm:mt-4 sm:flex", legendOpen ? "flex" : "hidden")}>
          {leaveTypesLegend.map((t) => {
            const icon = leaveIconFor(t.key);
            return (
              <span key={t.key} className="flex items-center gap-1.5" title={`${t.label} — barva použitá pro tento typ absence v kalendáři`}>
                {icon ? <LeaveTypeIcon name={icon} size={13} /> : null}
                <span className={cn("h-2.5 w-2.5 rounded-sm", colorDot[t.color])} />
                {t.label}
              </span>
            );
          })}
          <span className="flex items-center gap-1.5" title="U soukromých absencí (např. nemoc) kolegové důvod nevidí">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate" /> Nepřítomen
          </span>
          <span className="flex items-center gap-1.5 border-l border-line pl-4" title="Schválená absence — plná barva">
            <span className="h-2.5 w-5 rounded-sm bg-slate" /> Schváleno
          </span>
          <span className="flex items-center gap-1.5" title="Čeká na schválení — světlejší a šrafovaná barva stejného typu">
            <span className={cn("h-2.5 w-5 rounded-sm bg-slate opacity-70", hatch)} /> Čeká na schválení
          </span>
          <span className="flex items-center gap-1.5" title="Dny, na které admin/manažer nemůže naplánovat běžnou dovolenou">
            <span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Státní svátek
          </span>
          <span className="hidden items-center gap-1 lg:flex" title="Klávesové zkratky kalendáře">
            <kbd className="rounded border border-line bg-white px-1">←</kbd>
            <kbd className="rounded border border-line bg-white px-1">→</kbd> posun · <kbd className="rounded border border-line bg-white px-1">T</kbd> dnes ·
            <kbd className="rounded border border-line bg-white px-1">M</kbd>
            <kbd className="rounded border border-line bg-white px-1">2</kbd>
            <kbd className="rounded border border-line bg-white px-1">W</kbd> pohled
          </span>
          <span className="ml-auto flex items-center gap-1.5" title="Dnešní datum">
            <span className="h-2.5 w-2.5 rounded-sm border-2 border-teal" /> Dnes
          </span>
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
                      "rounded-t-sm border-b-2 pb-1.5 text-center text-[11px]",
                      isToday ? "border-teal-dark" : "border-line",
                      holidayName ? "bg-warning-light text-warning-dark" : isToday ? "bg-teal-light" : isWeekend(d) ? "bg-paper text-muted" : "bg-white"
                    )}
                  >
                    <div className={cn(isToday ? "font-semibold text-teal-dark" : "text-muted")}>{format(d, "EEEEEE", { locale: cs })}</div>
                    <div className={cn(isToday && "font-semibold text-teal-dark")}>{format(d, "d")}</div>
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
                    <button
                      onClick={() => toggleGroup(g.id)}
                      className="sticky left-0 z-10 flex w-full items-center gap-2 border-b border-line bg-paper px-2 py-1.5 text-left text-sm font-medium hover:bg-line/40"
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className={cn("h-2 w-2 rounded-full", colorDot[g.color])} />
                      {g.name} ({g.members.length})
                    </button>
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

      {requestDates && (
        <RequestLeaveModal
          trigger={null}
          open={!!requestDates}
          onOpenChange={(o) => !o && setRequestDates(null)}
          initialDates={requestDates}
          onSaved={() => {
            setRequestDates(null);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
