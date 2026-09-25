"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Mail } from "lucide-react";
import { differenceInCalendarDays, differenceInCalendarMonths } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { sendWellbeingReminder } from "@/lib/notifications";
import { errorMessage } from "@/lib/utils";

interface Props {
  employees: { id: string; name: string }[];
}

interface FlaggedRow {
  id: string;
  name: string;
  monthsSince: number | null;
}

// A "longer" vacation — enough to actually recover, not a single day off.
const LONG_VACATION_MIN_DAYS = 3;
const FLAG_AFTER_DAYS = 182; // ~6 months

/** Smart HR Insights — flags team members who haven't taken a proper break in 6+ months, so a manager can nudge them before it becomes a burnout problem. */
export function BurnoutWatch({ employees }: Props) {
  const [rows, setRows] = useState<FlaggedRow[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function remind(id: string) {
    setError(null);
    try {
      await sendWellbeingReminder(id);
      setSent((prev) => new Set(prev).add(id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  useEffect(() => {
    if (employees.length === 0) {
      setRows([]);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("profile_id, end_date, working_days, leave_type:leave_types(counts_against)")
        .eq("status", "approved")
        .in(
          "profile_id",
          employees.map((e) => e.id)
        );

      type Req = { profile_id: string; end_date: string; working_days: number; leave_type: { counts_against: string } | null };
      const longVacations = ((data as unknown as Req[]) ?? []).filter(
        (r) => r.leave_type?.counts_against === "vacation" && Number(r.working_days) >= LONG_VACATION_MIN_DAYS
      );

      const lastEndByProfile = new Map<string, string>();
      for (const r of longVacations) {
        const cur = lastEndByProfile.get(r.profile_id);
        if (!cur || r.end_date > cur) lastEndByProfile.set(r.profile_id, r.end_date);
      }

      const today = new Date();
      const flagged = employees
        .map((e) => {
          const lastEnd = lastEndByProfile.get(e.id) ?? null;
          const daysSince = lastEnd ? differenceInCalendarDays(today, new Date(lastEnd)) : null;
          const monthsSince = lastEnd ? differenceInCalendarMonths(today, new Date(lastEnd)) : null;
          return { id: e.id, name: e.name, monthsSince, daysSince };
        })
        .filter((e) => e.daysSince === null || e.daysSince >= FLAG_AFTER_DAYS)
        .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))
        .map(({ id, name, monthsSince }) => ({ id, name, monthsSince }));

      setRows(flagged);
    })();
  }, [employees]);

  if (rows === null || rows.length === 0) return null;

  return (
    <div className="card overflow-hidden border-warning-light bg-warning-light/20">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <AlertTriangle size={16} className="text-warning-dark" />
        <h2 className="font-display text-h2">Riziko vyhoření</h2>
      </div>
      <p className="px-5 pt-3 text-xs text-muted">
        Tito lidé si déle než 6 měsíců nevzali delší dovolenou (aspoň {LONG_VACATION_MIN_DAYS} dny v kuse) — stojí za to jim ji připomenout.
      </p>
      {error && <p className="px-5 pt-2 text-xs text-danger-dark">{error}</p>}
      <div className="divide-y divide-line px-1 pb-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-muted">{r.monthsSince === null ? "Nikdy nečerpal(a) delší dovolenou" : `Naposledy před ${r.monthsSince} měsíci`}</span>
              {sent.has(r.id) ? (
                <span className="flex items-center gap-1 text-xs text-teal-dark">
                  <Check size={13} /> Odesláno
                </span>
              ) : (
                <button
                  onClick={() => remind(r.id)}
                  className="flex items-center gap-1 rounded border border-line bg-white px-2 py-1 text-xs hover:bg-teal-light hover:text-teal-dark"
                  title="Pošle kolegovi přátelskou připomínku v aplikaci"
                >
                  <Mail size={12} /> Připomenout
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
