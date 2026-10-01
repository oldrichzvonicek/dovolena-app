"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DbCompany, DbLeaveType } from "@/lib/supabase/types";
import { fetchCompany } from "@/lib/admin-data";
import { createLeavePlan, LeavePlan } from "@/lib/leave-plans";
import { countWorkingDays, dayWord, workingDaysPhrase } from "@/lib/working-days";
import { errorMessage } from "@/lib/utils";

/**
 * "Naplánovat rok dopředu, bez odeslání ke schválení" — vědomě mnohem jednodušší než RequestLeaveModal:
 * žádná kolize s týmem, blokovaný termín ani limit zůstatku návrh neblokuje (je to jen soukromá poznámka,
 * ne závazná žádost) — jen typ a termín. Kdo o den skutečně požádá, projde normální žádostí s plnou
 * kontrolou (viz "Podat žádost" u návrhu, submitLeavePlan).
 */
export function PlanLeaveModal({
  open,
  onOpenChange,
  onSaved,
  existing = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** Vlastní návrhy uživatele — proti nim hlídáme duplicitu (stejný typ a termín nadvakrát). */
  existing?: LeavePlan[];
}) {
  const { profile } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [typeId, setTypeId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    const supabase = createClient();
    supabase
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const rows = (data as DbLeaveType[]) ?? [];
        setLeaveTypes(rows);
        if (rows[0]) setTypeId(rows[0].id);
      });
    fetchCompany(profile.company_id).then(setCompany);
    const today = new Date().toLocaleDateString("sv-SE");
    setStartDate(today);
    setEndDate(today);
    setNote("");
    setError(null);
  }, [open, profile]);

  const workingDays = countWorkingDays(startDate, endDate, company?.work_days);

  async function handleSubmit() {
    if (!profile || !typeId) return;
    if (endDate < startDate) return setError("Konec termínu musí být po jeho začátku.");
    if (existing.some((p) => p.leave_type_id === typeId && p.start_date === startDate && p.end_date === endDate)) {
      return setError("Tenhle termín a typ absence už máte naplánovaný — podívejte se do seznamu níže.");
    }
    setSubmitting(true);
    setError(null);
    try {
      await createLeavePlan({
        profile_id: profile.id,
        leave_type_id: typeId,
        start_date: startDate,
        end_date: endDate,
        half_day: false,
        working_days: workingDays,
        note: note || undefined,
      });
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Naplánovat volno"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !typeId || endDate < startDate}>
              <CalendarPlus size={15} /> {submitting ? "Ukládám…" : "Naplánovat"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="rounded border border-line bg-paper px-3 py-2 text-xs text-muted">
            Jen soukromá poznámka pro vás — nikdo jiný ji neuvidí a nikam se neodešle. Až budete chtít, „Podáte žádost“ jedním kliknutím a projde běžným schvalováním.
          </p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Od</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  if (v > endDate) setEndDate(v);
                }}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Do</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="rounded bg-paper px-3 py-2 text-sm text-ink">
            Celkem: <span className="font-medium">{workingDays > 0 ? workingDaysPhrase(workingDays) : `0 ${dayWord(0)}`}</span>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Poznámka (jen pro vás, volitelné)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full rounded border border-line px-3 py-2 text-sm" placeholder="Např. dovolená s rodinou" />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
