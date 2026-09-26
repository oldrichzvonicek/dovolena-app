"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/data";
import { ApprovalWarnings, computeApprovalWarnings, fetchMyDepartmentIds, autoApproveOwnPending } from "@/lib/approval-checks";
import { fetchDecisionScope } from "@/lib/approval-scope";
import { formatRange } from "@/lib/working-days";
import { formatNumber } from "@/lib/utils";
import { emitDataChanged, useOnDataChanged } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/utils";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  leave_type: { key: string; label: string; counts_against: string } | null;
  profile: { id: string; name: string; manager_id: string | null; department_id: string | null } | null;
}

const MAX_SHOWN = 3;

/** Manager/admin shortcut: pending requests right on the dashboard, approvable in one click. */
export function PendingApprovalsWidget({ onChanged }: { onChanged?: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [warnings, setWarnings] = useState<ApprovalWarnings>({ remaining: {}, capacity: {} });
  const [reason, setReason] = useState("");

  const isManager = profile?.role === "manager" || profile?.role === "admin";

  async function load() {
    if (!profile || !isManager) return;
    await autoApproveOwnPending(profile).catch(() => false);
    const { data } = await createClient()
      .from("leave_requests")
      .select(
        "id, start_date, end_date, working_days, leave_type:leave_types(key, label, counts_against), profile:profiles!leave_requests_profile_id_fkey(id, name, manager_id, department_id)"
      )
      .eq("status", "pending")
      .order("start_date", { ascending: true });
    const scope = await fetchDecisionScope(profile);
    const list = ((data as unknown as Row[]) ?? []).filter((r) => r.profile && r.leave_type && scope.canDecide(r.profile) && r.profile.id !== profile.id);
    // Own direct reports first, same ordering convention as the Ke schválení page.
    const mine = await fetchMyDepartmentIds(profile.company_id, profile.id);
    const isMine = (r: Row) => r.profile?.manager_id === profile.id || (!!r.profile?.department_id && mine.has(r.profile.department_id));
    list.sort((a, b) => Number(isMine(b)) - Number(isMine(a)));
    setRows(list);
    setWarnings(
      await computeApprovalWarnings(
        profile.company_id,
        list.map((r) => ({
          id: r.id,
          start_date: r.start_date,
          end_date: r.end_date,
          working_days: r.working_days,
          counts_against: r.leave_type!.counts_against,
          type_key: r.leave_type!.key,
          profile: { id: r.profile!.id, department_id: r.profile!.department_id },
        }))
      )
    );
  }

  useOnDataChanged(() => load());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function run(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      emitDataChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!isManager || !rows || rows.length === 0 || !profile) return null;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning-light/40 p-5">
      <div className="flex items-center gap-2 font-display text-h2">
        <AlertTriangle size={18} className="text-warning-dark" /> Čeká na vaše schválení ({rows.length})
      </div>
      <div className="mt-3 space-y-2">
        {rows.slice(0, MAX_SHOWN).map((r) => {
          const negative = warnings.remaining[r.id] !== undefined && warnings.remaining[r.id] < 0 ? warnings.remaining[r.id] : null;
          const capacity = warnings.capacity[r.id];
          const hasWarning = negative !== null || !!capacity;
          return (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-white px-4 py-2.5">
            <div className="text-sm">
              <span className="font-medium">{r.profile?.name}</span> – {r.leave_type?.label}{" "}
              <span className="text-muted">({formatRange(r.start_date, r.end_date)})</span>
              {negative !== null && <div className="mt-0.5 text-xs text-danger-dark">⚠ Po schválení zůstatek {formatNumber(negative)} dní (minus).</div>}
              {capacity && (
                <div className="mt-0.5 text-xs text-warning-dark">
                  ⚠ Chybělo by {capacity.count} z {capacity.size} lidí oddělení ({capacity.percent} %).
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {hasWarning ? (
                <Link href={`/approvals?zadost=${r.id}`} className="inline-flex items-center rounded border border-warning/50 bg-warning-light px-3 py-1.5 text-sm font-medium text-warning-dark hover:bg-warning-light/70">
                  Zkontrolovat
                </Link>
              ) : (
                <Button className="px-3 py-1.5 text-sm" disabled={busyId === r.id} onClick={() => run(r.id, () => approveLeaveRequest(r.id, profile.id))}>
                  <Check size={14} /> Schválit
                </Button>
              )}
              <Button
                variant="danger"
                className="px-3 py-1.5 text-sm"
                disabled={busyId === r.id}
                onClick={() => {
                  setReason("");
                  setRejecting(r);
                }}
              >
                <X size={14} /> Zamítnout
              </Button>
              <Link href={`/approvals?zadost=${r.id}`} className="inline-flex items-center rounded border border-line bg-white px-3 py-1.5 text-sm hover:bg-paper">
                Detail
              </Link>
            </div>
          </div>
          );
        })}
      </div>
      {rows.length > MAX_SHOWN && (
        <Link
          href="/approvals"
          className="mt-3 inline-flex items-center gap-1.5 rounded border border-warning/50 bg-white px-3 py-1.5 text-sm font-medium text-warning-dark hover:bg-warning-light"
        >
          Zobrazit zbývající žádosti ({rows.length - MAX_SHOWN}) →
        </Link>
      )}
      {error && <p className="mt-2 text-sm text-danger-dark">{error}</p>}

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent title="Zamítnout žádost">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {rejecting?.profile?.name} – {rejecting?.leave_type?.label}
            </p>
            <label className="block text-sm font-medium">Důvod zamítnutí</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Např. Není zajištěn provoz e-shopu" aria-label="Např. Není zajištěn provoz e-shopu"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejecting(null)}>
                Zrušit
              </Button>
              <Button
                variant="danger"
                disabled={!reason.trim()}
                onClick={() => {
                  const target = rejecting;
                  setRejecting(null);
                  if (target) run(target.id, () => rejectLeaveRequest(target.id, profile.id, reason.trim()));
                }}
              >
                Potvrdit zamítnutí
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
