"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DbDepartment } from "@/lib/supabase/types";

export function CalendarFilter({
  department,
  onDepartmentChange,
  monthLabel,
  departments,
}: {
  department: string;
  onDepartmentChange: (v: string) => void;
  monthLabel: string;
  departments: DbDepartment[];
}) {
  return (
    <div className="flex items-center justify-between">
      <Select value={department} onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-56">
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

      <div className="flex items-center gap-3">
        <button className="rounded p-1.5 hover:bg-paper" aria-label="Předchozí měsíc" disabled>
          <ChevronLeft size={18} />
        </button>
        <span className="w-32 text-center font-display text-base capitalize">{monthLabel}</span>
        <button className="rounded p-1.5 hover:bg-paper" aria-label="Další měsíc" disabled>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
