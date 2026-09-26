"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LeaveBadge, StatusBadge } from "@/components/ui/badge";
import { dayWord, formatRange } from "@/lib/working-days";
import { cn, formatNumber } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Balance, loadBalances } from "@/lib/balances";
import { LeaveColor, RequestStatus } from "@/lib/supabase/types";
import { LoadingLines } from "@/components/ui/skeleton";

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
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const todayIso = new Date().toLocaleDateString("sv-SE");

  const types = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const r of rows ?? []) m.set(r.leave_type.key, { label: r.leave_type.label, count: (m.get(r.leave_type.key)?.count ?? 0) + 1 });
    return Array.from(m.entries());
  }, [rows]);
  const years = useMemo(() => Array.from(new Set((rows ?? []).map((r) => Number(r.start_date.slice(0, 4))))).sort((a, b) => b - a), [rows]);
  const filtered = (rows ?? []).filter((r) => (!typeKey || r.leave_type.key === typeKey) && (year === null || r.start_date.startsWith(String(year))));
  const upcoming = filtered.filter((r) => r.end_date >= todayIso).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = filtered.filter((r) => r.end_date < todayIso);
  const filteredDays = filtered.filter((r) => r.status === "approved").reduce((sum, r) => sum + Number(r.working_days), 0);

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
        {rows === null && <LoadingLines rows={4} />}
        {rows && rows.length === 0 && <p className="text-sm text-muted">Zatím žádné žádosti.</p>}
        {rows && rows.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtr podle druhu absence">
              <button onClick={() => setTypeKey(null)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", typeKey === null ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-paper")}>
                Vše ({rows.length})
              </button>
              {types.map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setTypeKey(key === typeKey ? null : key)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", typeKey === key ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-paper")}
                >
                  {t.label} ({t.count})
                </button>
              ))}
              {years.length > 1 && (
                <select value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)} aria-label="Rok" className="ml-auto rounded border border-line bg-white px-2 py-1 text-xs">
                  <option value="">Všechny roky</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="mb-2 text-xs text-muted">
              {filtered.length} {filtered.length === 1 ? "záznam" : filtered.length < 5 ? "záznamy" : "záznamů"} · schválených dnů celkem {formatNumber(filteredDays)}
            </p>
            {filtered.length === 0 && <p className="text-sm text-muted">Filtru neodpovídá žádná absence.</p>}
            {(
              [
                ["Nadcházející a plánované", upcoming],
                ["Proběhlé", past],
              ] as const
            ).map(([title, list]) =>
              list.length === 0 ? null : (
                <div key={title} className="mb-3">
                  <div className="sticky top-0 bg-white py-1 text-[11px] font-medium uppercase tracking-wide text-muted">{title} ({list.length})</div>
                  <div className="divide-y divide-line">
                    {list.map((r) => (
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
                </div>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
