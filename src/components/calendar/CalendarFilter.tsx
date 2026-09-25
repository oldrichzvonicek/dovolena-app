"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DbDepartment, LeaveColor } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type CalendarViewMode = "day" | "week" | "2weeks" | "month";

const viewLabel: Record<CalendarViewMode, string> = { day: "Den", week: "Týden", "2weeks": "2 týdny", month: "Měsíc" };
const viewKey: Record<CalendarViewMode, string> = { day: "D", week: "W", "2weeks": "2", month: "M" };

export function CalendarFilter({
  department,
  onDepartmentChange,
  departments,
  leaveTypeFilter,
  onLeaveTypeFilterChange,
  leaveTypes,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  periodLabel,
  onPrev,
  onNext,
  onToday,
}: {
  department: string;
  onDepartmentChange: (v: string) => void;
  departments: DbDepartment[];
  leaveTypeFilter: string;
  onLeaveTypeFilterChange: (v: string) => void;
  leaveTypes: { key: string; label: string; color: LeaveColor }[];
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (v: CalendarViewMode) => void;
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[140px] flex-1 sm:flex-none">
        <Select value={department} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filtr podle oddělení">
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
        </div>

        <div className="min-w-[140px] flex-1 sm:flex-none">
        <Select value={leaveTypeFilter} onValueChange={onLeaveTypeFilterChange}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filtr podle typu absence">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny absence</SelectItem>
            {leaveTypes.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>

        <div className="relative w-full sm:w-auto">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Hledat zaměstnance…" aria-label="Hledat zaměstnance"
            className="w-full rounded border border-line py-2 pl-8 pr-3 text-sm sm:w-48"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 rounded border border-line p-1 text-sm">
          {(Object.keys(viewLabel) as CalendarViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewModeChange(v)}
              title={`${viewLabel[v]} (klávesa ${viewKey[v]})`}
              aria-pressed={viewMode === v}
              className={cn("rounded px-2.5 py-1", viewMode === v ? "bg-teal text-white" : "text-muted hover:bg-paper")}
            >
              {viewLabel[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button onClick={onPrev} className="rounded p-1.5 hover:bg-paper" aria-label="Předchozí období" title="Předchozí období (šipka ←)">
          <ChevronLeft size={18} />
        </button>
        <span className="text-center font-display text-base capitalize">{periodLabel}</span>
        <button onClick={onNext} className="rounded p-1.5 hover:bg-paper" aria-label="Další období" title="Další období (šipka →)">
          <ChevronRight size={18} />
        </button>
        <button onClick={onToday} className="ml-1 rounded border border-line px-2.5 py-1 text-xs hover:bg-paper" title="Přejít na dnešek (klávesa T)">
          Dnes
        </button>
      </div>
    </div>
  );
}
