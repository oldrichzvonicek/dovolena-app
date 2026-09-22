"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { countWorkingDays } from "@/lib/working-days";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DbLeaveType, DbProfile } from "@/lib/supabase/types";
import { createLeaveRequest } from "@/lib/data";

export function RequestLeaveModal({ onCreated }: { onCreated?: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [colleagues, setColleagues] = useState<DbProfile[]>([]);

  const [typeId, setTypeId] = useState<string>("");
  const [halfDay, setHalfDay] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [coveringId, setCoveringId] = useState<string>("");
  const [conflictName, setConflictName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    const supabase = createClient();
    supabase
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .then(({ data }) => {
        setLeaveTypes((data as DbLeaveType[]) ?? []);
        if (data && data.length > 0) setTypeId((data as DbLeaveType[])[0].id);
      });
    supabase
      .from("profiles")
      .select("*")
      .eq("company_id", profile.company_id)
      .neq("id", profile.id)
      .then(({ data }) => setColleagues((data as DbProfile[]) ?? []));
  }, [open, profile]);

  const workingDays = useMemo(() => {
    if (halfDay) return 0.5;
    return countWorkingDays(startDate, endDate);
  }, [startDate, endDate, halfDay]);

  // Live collision check against everyone else's approved leave in the same range.
  useEffect(() => {
    if (!profile || !open) return;
    const supabase = createClient();
    supabase
      .from("leave_requests")
      .select("start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(id, name)")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .neq("profile_id", profile.id)
      .limit(1)
      .then(({ data }) => {
        const row = (data as unknown as { profile: { name: string } | null }[])?.[0];
        setConflictName(row?.profile?.name ?? null);
      });
  }, [startDate, endDate, profile, open]);

  async function handleSubmit() {
    if (!profile || !typeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createLeaveRequest({
        profile_id: profile.id,
        leave_type_id: typeId,
        start_date: startDate,
        end_date: halfDay ? startDate : endDate,
        half_day: halfDay,
        working_days: workingDays,
        note: note || undefined,
        covering_profile_id: coveringId || null,
      });
      setOpen(false);
      setNote("");
      setCoveringId("");
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se odeslat žádost.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" className="text-base px-5 py-2.5">
          <Plus size={18} /> Nová žádost o volno
        </Button>
      </DialogTrigger>
      <DialogContent title="Nová žádost o volno">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Typ absence</label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Délka trvání</label>
            <div className="flex gap-1 rounded border border-line p-1 text-sm">
              <button
                onClick={() => setHalfDay(false)}
                className={`flex-1 rounded px-3 py-1.5 ${!halfDay ? "bg-teal text-white" : "text-muted"}`}
              >
                Celý den / více dní
              </button>
              <button
                onClick={() => setHalfDay(true)}
                className={`flex-1 rounded px-3 py-1.5 ${halfDay ? "bg-teal text-white" : "text-muted"}`}
              >
                Půlden
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Od</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Do</label>
              <input
                type="date"
                value={endDate}
                disabled={halfDay}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm disabled:bg-paper"
              />
            </div>
          </div>

          <div className="rounded bg-paper px-3 py-2 text-sm text-ink">
            Celkem: <span className="font-medium">{workingDays} pracovní{workingDays === 1 ? "ho dne" : workingDays < 5 ? " dny" : " dní"}</span>{" "}
            <span className="text-muted">— víkendy a státní svátky odečteny automaticky</span>
          </div>

          {conflictName && (
            <div className="flex items-start gap-2 rounded border border-amber/30 bg-amber-light px-3 py-2 text-sm text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
              <span>
                Ve stejném termínu má volno <strong>{conflictName}</strong>.
              </span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Poznámka pro manažera (volitelné)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              placeholder="Např. důvod žádosti"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Zastupování (volitelné)</label>
            <Select value={coveringId} onValueChange={setCoveringId}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte kolegu" />
              </SelectTrigger>
              <SelectContent>
                {colleagues.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-rust">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !typeId}>
              {submitting ? "Odesílám…" : "Odeslat ke schválení"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
