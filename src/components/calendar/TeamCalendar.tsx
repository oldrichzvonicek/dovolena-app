"use client";

import { useEffect, useState } from "react";
import { eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarFilter } from "./CalendarFilter";
import { isCzechHoliday } from "@/lib/working-days";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DbDepartment, DbProfile, LeaveColor } from "@/lib/supabase/types";

const colorDot: Record<LeaveColor, string> = {
  teal: "bg-teal",
  rust: "bg-rust",
  moss: "bg-moss",
  violet: "bg-violet",
  amber: "bg-amber",
};

interface RequestRow {
  id: string;
  start_date: string;
  end_date: string;
  profile_id: string;
  covering_profile_id: string | null;
  leave_type: { key: string; label: string; color: LeaveColor };
}

export function TeamCalendar() {
  const { profile } = useAuth();
  const [department, setDepartment] = useState("all");
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<DbProfile[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [leaveTypesLegend, setLeaveTypesLegend] = useState<{ key: string; label: string; color: LeaveColor }[]>([]);

  const monthAnchor = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(monthAnchor), end: endOfMonth(monthAnchor) });

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();

    supabase.from("departments").select("*").eq("company_id", profile.company_id).then(({ data }) => setDepartments(data ?? []));
    supabase.from("profiles").select("*").eq("company_id", profile.company_id).then(({ data }) => setEmployees(data ?? []));
    supabase
      .from("leave_types")
      .select("key, label, color")
      .eq("company_id", profile.company_id)
      .then(({ data }) => setLeaveTypesLegend(data ?? []));
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, profile_id, covering_profile_id, leave_type:leave_types(key, label, color)")
      .eq("status", "approved")
      .then(({ data }) => setRequests((data as unknown as RequestRow[]) ?? []));
  }, [profile]);

  const visibleEmployees = department === "all" ? employees : employees.filter((e) => e.department_id === department);

  return (
    <div className="card p-5">
      <CalendarFilter
        department={department}
        onDepartmentChange={setDepartment}
        monthLabel={format(monthAnchor, "LLLL yyyy", { locale: cs })}
        departments={departments}
      />

      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[200px_1fr]">
            <div />
            <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}>
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "border-b border-line pb-1.5 text-center text-[11px]",
                    (isWeekend(d) || isCzechHoliday(d)) && "bg-paper text-muted"
                  )}
                >
                  <div className="text-muted">{format(d, "EEEEEE", { locale: cs })}</div>
                  <div>{format(d, "d")}</div>
                </div>
              ))}
            </div>
          </div>

          {visibleEmployees.map((emp) => {
            const dept = departments.find((d) => d.id === emp.department_id);
            const empRequests = requests.filter((r) => r.profile_id === emp.id);

            return (
              <div key={emp.id} className="grid grid-cols-[200px_1fr] items-center border-b border-line py-2 last:border-0">
                <div className="pr-3">
                  <div className="text-sm font-medium">{emp.name}</div>
                  <div className="text-xs text-muted">{dept?.name}</div>
                </div>
                <div className="relative grid h-7" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(28px, 1fr))` }}>
                  {days.map((d) => (
                    <div key={d.toISOString()} className={cn("h-full", (isWeekend(d) || isCzechHoliday(d)) && "bg-paper")} />
                  ))}
                  {empRequests.map((r) => {
                    const startIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.start_date);
                    const endIdx = days.findIndex((d) => format(d, "yyyy-MM-dd") === r.end_date);
                    if (startIdx === -1 || endIdx === -1) return null;
                    const covering = employees.find((e) => e.id === r.covering_profile_id);
                    return (
                      <div
                        key={r.id}
                        title={`${emp.name} – ${r.leave_type.label} (Schváleno)${covering ? ` | Zastupuje: ${covering.name}` : ""}`}
                        className={cn("absolute top-0.5 h-6 rounded-sm opacity-90 hover:opacity-100", colorDot[r.leave_type.color])}
                        style={{
                          left: `calc(${(startIdx / days.length) * 100}% + 2px)`,
                          width: `calc(${((endIdx - startIdx + 1) / days.length) * 100}% - 4px)`,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-xs text-muted">
        {leaveTypesLegend.map((t) => (
          <span key={t.key} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-sm", colorDot[t.color])} />
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
