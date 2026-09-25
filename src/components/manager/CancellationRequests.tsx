"use client";

import { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { resolveLeaveCancellation } from "@/lib/data";
import { formatRange } from "@/lib/working-days";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { emitDataChanged, useOnDataChanged } from "@/lib/events";
import { fetchDecisionScope } from "@/lib/approval-scope";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: { label: string } | null;
  profile: { name: string; manager_id: string | null; department_id: string | null } | null;
}

/** Manager/admin queue of approved absences the employee asked to cancel. Renders nothing when empty. */
export function CancellationRequests({ onChanged }: { onChanged?: () => void }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isManager = profile?.role === "manager" || profile?.role === "admin";

  async function load() {
    if (!isManager) return;
    // Errors (column not migrated yet) simply mean "no cancellation requests".
    const { data } = await createClient()
      .from("leave_requests")
      .select("id, start_date, end_date, leave_type:leave_types(label), profile:profiles!leave_requests_profile_id_fkey(name, manager_id, department_id)")
      .not("cancellation_requested_at", "is", null)
      .order("start_date", { ascending: true });
    const scope = profile ? await fetchDecisionScope(profile) : null;
    setRows(((data as unknown as Row[]) ?? []).filter((r) => r.profile && (!scope || scope.canDecide(r.profile))));
  }

  useOnDataChanged(() => load());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function resolve(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await resolveLeaveCancellation(id, approve);
      emitDataChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (!isManager || rows.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-warning/40 bg-warning-light/40 p-5">
      <div className="flex items-center gap-2 font-display text-h2">
        <Undo2 size={18} className="text-warning-dark" /> Žádosti o zrušení absence ({rows.length})
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded bg-white px-4 py-2.5">
            <div className="text-sm">
              <span className="font-medium">{r.profile?.name}</span> – {r.leave_type?.label}{" "}
              <span className="text-muted">({formatRange(r.start_date, r.end_date)})</span>
            </div>
            <div className="flex gap-2">
              <Button className="px-3 py-1.5 text-sm" disabled={busyId === r.id} onClick={() => resolve(r.id, true)}>
                Schválit zrušení
              </Button>
              <Button variant="secondary" className="px-3 py-1.5 text-sm" disabled={busyId === r.id} onClick={() => resolve(r.id, false)}>
                Ponechat absenci
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-danger-dark">{error}</p>}
    </div>
  );
}
