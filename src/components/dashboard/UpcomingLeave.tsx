"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Undo2, X } from "lucide-react";
import { KebabMenu, KebabItem } from "@/components/shared/KebabMenu";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";
import { LoadingLines } from "@/components/ui/skeleton";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { cancelLeaveRequest, requestLeaveCancellation } from "@/lib/data";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { emitDataChanged, useOnDataChanged } from "@/lib/events";
import { errorMessage } from "@/lib/utils";

interface UpcomingRow {
  id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note: string | null;
  covering_profile_id: string | null;
  status: "approved" | "pending";
  cancellation_requested_at?: string | null;
  leave_type: { id: string; key: string; label: string; color: "teal" | "rust" | "moss" | "violet" | "amber" };
}

const VISIBLE = 4;
const todayISO = () => new Date().toLocaleDateString("sv-SE");

/**
 * Dřív jen statický výpis (typ, termín, stav) — kvůli jakékoli změně se muselo přes Moje žádosti. Teď má
 * čekající žádost rovnou Upravit/Zrušit a schválená (ještě neproběhlá) Požádat o zrušení, přímo na nástěnce.
 */
export function UpcomingLeave() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<UpcomingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [editingRow, setEditingRow] = useState<UpcomingRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!profile) return;
    const supabase = createClient();
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, half_day, working_days, note, covering_profile_id, status, cancellation_requested_at, leave_type:leave_types(id, key, label, color)")
      .eq("profile_id", profile.id)
      .in("status", ["approved", "pending"])
      .gte("end_date", todayISO())
      .order("start_date", { ascending: true })
      .then(({ data, error: err }) => {
        // cancellation_requested_at potřebuje aktuální schema.sql; bez ní se sloupec zkusí znovu bez něj.
        if (err) {
          supabase
            .from("leave_requests")
            .select("id, start_date, end_date, half_day, working_days, note, covering_profile_id, status, leave_type:leave_types(id, key, label, color)")
            .eq("profile_id", profile.id)
            .in("status", ["approved", "pending"])
            .gte("end_date", todayISO())
            .order("start_date", { ascending: true })
            .then(({ data: d2 }) => {
              setRows((d2 as unknown as UpcomingRow[]) ?? []);
              setLoading(false);
            });
          return;
        }
        setRows((data as unknown as UpcomingRow[]) ?? []);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);
  useOnDataChanged(load);

  async function handleCancel(id: string) {
    if (!(await confirmDialog("Zrušit tuto žádost? Nejde vzít zpět — pro jiný termín podáte novou.", { confirmLabel: "Zrušit žádost", danger: true }))) return;
    setBusyId(id);
    setError(null);
    try {
      await cancelLeaveRequest(id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRequestCancellation(r: UpcomingRow) {
    if (!(await confirmDialog("Požádat manažera o zrušení této schválené absence?", { confirmLabel: "Požádat o zrušení" }))) return;
    setBusyId(r.id);
    setError(null);
    try {
      await requestLeaveCancellation(r.id);
      emitDataChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  const shown = showAll ? rows : rows.slice(0, VISIBLE);

  return (
    <div className="card p-5">
      <h2 className="font-display text-h2">Moje nadcházející absence</h2>
      <div className="mt-3">
        {loading && <LoadingLines rows={2} />}
        {!loading && rows.length === 0 && <p className="text-sm text-muted">Žádná naplánovaná absence.</p>}
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        <ul className="divide-y divide-line">
          {shown.map((r) => {
            const canCancelApproved = r.status === "approved" && r.end_date >= todayISO();
            const cancellationPending = !!r.cancellation_requested_at;
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                <LeaveBadge type={r.leave_type} className="shrink-0" />
                <span className="text-sm font-medium">{formatRange(r.start_date, r.end_date)}</span>
                {r.status === "pending" && (
                  <span className="rounded-sm bg-warning-light px-1.5 py-0.5 text-[11px] font-medium text-warning-dark">⏳ Čeká na schválení</span>
                )}
                {r.note && <span className="min-w-0 max-w-[16rem] truncate text-xs text-muted">{r.note}</span>}
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                  {r.status === "pending" && (
                    <>
                      <button
                        onClick={() => setEditingRow(r)}
                        className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
                      >
                        <Pencil size={12} /> Upravit
                      </button>
                      <KebabMenu
                        items={[{ label: busyId === r.id ? "Ruším…" : "Zrušit žádost", icon: <X size={13} />, onClick: () => handleCancel(r.id), danger: true } satisfies KebabItem]}
                      />
                    </>
                  )}
                  {canCancelApproved &&
                    (cancellationPending ? (
                      <span className="rounded-sm bg-warning-light px-2 py-1 text-xs font-medium text-warning-dark">⏳ Zrušení odesláno</span>
                    ) : (
                      // Schválených řádků bývá víc než jeden — plnohodnotné tlačítko v každém by na obrazovce
                      // dělalo zbytečný vizuální hluk. "..." nabídne stejnou akci, jen míň nápadně.
                      <KebabMenu
                        items={[{ label: busyId === r.id ? "Ruším…" : "Požádat o zrušení", icon: <Undo2 size={13} />, onClick: () => handleRequestCancellation(r), danger: true } satisfies KebabItem]}
                      />
                    ))}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex items-center gap-3">
          {rows.length > VISIBLE && (
            // "Zobrazit dalších" (rozbalí tenhle seznam na místě), ne "Zobrazit všech" — to vedle odkazu
            // na /requests vypadalo jako dva odkazy na totéž.
            <button onClick={() => setShowAll((v) => !v)} className="text-sm font-medium text-teal-dark hover:underline">
              {showAll ? "Zobrazit méně" : `Zobrazit dalších ${rows.length - VISIBLE} →`}
            </button>
          )}
          {rows.length > 0 && (
            <Link href="/requests" className="text-sm text-muted hover:underline">
              Celá historie žádostí →
            </Link>
          )}
        </div>
      </div>

      {editingRow && (
        <RequestLeaveModal
          trigger={null}
          open={!!editingRow}
          onOpenChange={(o) => !o && setEditingRow(null)}
          editingRequest={{
            id: editingRow.id,
            leave_type_id: editingRow.leave_type.id,
            start_date: editingRow.start_date,
            end_date: editingRow.end_date,
            half_day: editingRow.half_day,
            working_days: editingRow.working_days,
            note: editingRow.note,
            covering_profile_id: editingRow.covering_profile_id,
          }}
          onSaved={() => {
            setEditingRow(null);
            load();
          }}
        />
      )}
    </div>
  );
}
