"use client";

import { eachDayOfInterval, endOfMonth, format, getDay, isSameDay, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";

/** Small single-month calendar with a date range highlighted — used where an
 * approver needs to visualize a request's dates without leaving the list. */
export function MiniCalendar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const monthAnchor = start;
  const days = eachDayOfInterval({ start: startOfMonth(monthAnchor), end: endOfMonth(monthAnchor) });
  // Monday-first leading blanks so the grid lines up under Po/Út/.../Ne.
  const leadingBlanks = (getDay(startOfMonth(monthAnchor)) + 6) % 7;
  const today = new Date();

  return (
    <div className="w-56 rounded border border-line bg-white p-2.5">
      <div className="mb-1.5 text-center text-xs font-medium capitalize">{format(monthAnchor, "LLLL yyyy", { locale: cs })}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px]">
        {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
          <div key={d} className="text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const inRange = isWithinInterval(d, { start, end });
          const isRangeStart = isSameDay(d, start);
          const isRangeEnd = isSameDay(d, end);
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="flex items-center justify-center py-0.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                  inRange && "bg-teal text-white",
                  (isRangeStart || isRangeEnd) && "font-semibold ring-2 ring-teal-dark ring-offset-1",
                  !inRange && isToday && "border border-teal text-teal-dark"
                )}
              >
                {format(d, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
