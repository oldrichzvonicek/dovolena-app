"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LeaveBadge, StatusBadge } from "@/components/ui/badge";
import { dayWord, formatRange } from "@/lib/working-days";
import { formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Balance, loadBalances } from "@/lib/balances";
import { LeaveColor, RequestStatus } from "@/lib/supabase/types";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: RequestStatus;
  leave_type: { key: string; label: string; color: LeaveColor };
}

/** Absence history of one employee, opened from the row actions on Můj tým. */
export function EmployeeDetailModal({ employee, onClose }: { employee: { id: string; name: string }; onClose: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<{ vac: Balance; sick: Balance } | null>(null);

  useEffect(() => {
    if (!profile) return;
    loadBalances(profile.company_id, { profileId: employee.id }).then((b) => setSummary({ vac: b.get(employee.id, "vacation"), sick: b.get(employee.id, "sick") }));
  }, [profile, employee.id]);

  useEffect(() => {
    createClient()
      .from("leave_requests")
      .select("id, start_date, end_date, working_days, status, leave_type:leave_types(key, label, color)")
      .eq("profile_id", employee.id)
      .order("start_date", { ascending: false })
      .then(({ data }) => setRows((data as unknown as Row[]) ?? []));
  }, [employee.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Absence — ${employee.name}`}>
        {summary && (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded bg-paper px-3 py-2 text-sm">
            <span>
              <span className="text-muted">Dovolená:</span>{" "}
              <span className="font-medium">
                {formatNumber(summary.vac.used + summary.vac.upcoming)}/{formatNumber(summary.vac.total)} dní
              </span>
            </span>
            <span>
              <span className="text-muted">Sick Days:</span>{" "}
              <span className="font-medium">
                {formatNumber(summary.sick.used + summary.sick.upcoming)}/{formatNumber(summary.sick.total)} dní
              </span>
            </span>
          </div>
        )}
        {rows === null && <p className="text-sm text-muted">Načítám…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-muted">Zatím žádné žádosti.</p>}
        {rows && rows.length > 0 && (
          <div className="divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <LeaveBadge type={r.leave_type} />
                  <div>
                    <div className="font-medium">{formatRange(r.start_date, r.end_date)}</div>
                    <div className="text-xs text-muted">
                      {formatNumber(Number(r.working_days))} {dayWord(Number(r.working_days))}
                    </div>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
