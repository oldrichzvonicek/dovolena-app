"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/data";
import { LeaveBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatRange } from "@/lib/working-days";
import { LeaveColor } from "@/lib/supabase/types";

interface PendingRow {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  note: string | null;
  leave_type: { key: string; label: string; color: LeaveColor };
  profile: { id: string; name: string; avatar_initials: string | null };
}

export function PendingApprovals() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("leave_requests")
      .select(
        `id, start_date, end_date, working_days, note,
         leave_type:leave_types(key, label, color),
         profile:profiles!leave_requests_profile_id_fkey(id, name, avatar_initials)`
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const rows = (data as unknown as PendingRow[]) ?? [];
    setPending(rows);

    // For each pending request, check if anyone else already has approved leave overlapping it.
    const conflictMap: Record<string, string> = {};
    for (const r of rows) {
      const { data: overlap } = await supabase
        .from("leave_requests")
        .select("profile:profiles!leave_requests_profile_id_fkey(name)")
        .eq("status", "approved")
        .neq("profile_id", r.profile.id)
        .lte("start_date", r.end_date)
        .gte("end_date", r.start_date)
        .limit(1);
      const name = (overlap as unknown as { profile: { name: string } | null }[])?.[0]?.profile?.name;
      if (name) conflictMap[r.id] = name;
    }
    setConflicts(conflictMap);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve(id: string) {
    if (!profile) return;
    await approveLeaveRequest(id, profile.id);
    load();
  }

  async function reject(id: string, reason: string) {
    if (!profile) return;
    await rejectLeaveRequest(id, profile.id, reason);
    load();
  }

  if (loading) {
    return <div className="card p-8 text-center text-sm text-muted">Načítám…</div>;
  }

  if (pending.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">Žádné žádosti nečekají na schválení. 🎉</div>;
  }

  return (
    <div className="card divide-y divide-line">
      {pending.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-medium">
              {r.profile.avatar_initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{r.profile.name}</div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <LeaveBadge type={r.leave_type} />
                <span>{formatRange(r.start_date, r.end_date)}</span>
                <span>· {r.working_days} dní</span>
              </div>
              {conflicts[r.id] && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-amber">
                  <AlertTriangle size={13} />
                  Konflikt s {conflicts[r.id]}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <RejectDialog onConfirm={(reason) => reject(r.id, reason)} />
            <Button variant="primary" className="bg-moss hover:bg-moss/90" onClick={() => approve(r.id)}>
              <Check size={16} /> Schválit
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RejectDialog({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">
          <X size={16} /> Zamítnout
        </Button>
      </DialogTrigger>
      <DialogContent title="Zamítnout žádost">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Důvod zamítnutí</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Např. Není zajištěn provoz e-shopu"
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onConfirm(reason);
                setOpen(false);
              }}
            >
              Potvrdit zamítnutí
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
