"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { countWorkingDays, workingDaysPhrase } from "@/lib/working-days";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { bookLeaveForEmployee, fetchCompany } from "@/lib/admin-data";
import { DbLeaveType, DbProfile } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";
import { fetchDecisionScope } from "@/lib/approval-scope";

type DurationMode = "full" | "half" | "hours";

export function BookForEmployeeModal({
  onSaved,
  presetEmployeeId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger,
}: {
  onSaved?: () => void;
  presetEmployeeId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { profile } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [employees, setEmployees] = useState<DbProfile[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [dailyHours, setDailyHours] = useState(8);
  const [workDays, setWorkDays] = useState<number[] | undefined>(undefined);

  const [employeeId, setEmployeeId] = useState(presetEmployeeId ?? "");

  useEffect(() => {
    if (open && presetEmployeeId) setEmployeeId(presetEmployeeId);
  }, [open, presetEmployeeId]);
  const [typeId, setTypeId] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("full");
  const [hoursValue, setHoursValue] = useState(4);
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .neq("id", profile.id)
      .then(async ({ data }) => {
        // A manager books only for their own people (the database enforces this too); admins for everyone.
        const scope = await fetchDecisionScope(profile);
        setEmployees(((data as DbProfile[]) ?? []).filter((e) => scope.canDecide(e)));
      });
    supabase
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const rows = (data as DbLeaveType[]) ?? [];
        setLeaveTypes(rows);
        const firstActive = rows.find((t) => t.active) ?? rows[0];
        if (firstActive) setTypeId(firstActive.id);
      });
    fetchCompany(profile.company_id).then((c) => {
      setDailyHours(c.standard_daily_hours);
      setWorkDays(c.work_days);
    });
  }, [open, profile]);

  useEffect(() => {
    if (startDate !== endDate && durationMode !== "full") setDurationMode("full");
  }, [startDate, endDate, durationMode]);

  const selectedType = leaveTypes.find((t) => t.id === typeId);

  useEffect(() => {
    if (!selectedType) return;
    if (durationMode === "half" && !selectedType.allow_half_day) setDurationMode("full");
    if (durationMode === "hours" && !selectedType.allow_hours) setDurationMode("full");
  }, [selectedType, durationMode]);

  const workingDays = useMemo(() => {
    if (durationMode === "half") return 0.5;
    if (durationMode === "hours") return dailyHours > 0 ? Math.round((hoursValue / dailyHours) * 1000) / 1000 : 0;
    return countWorkingDays(startDate, endDate, workDays);
  }, [startDate, endDate, durationMode, hoursValue, dailyHours, workDays]);

  async function handleSubmit() {
    if (!profile || !employeeId || !typeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await bookLeaveForEmployee(profile.id, {
        profile_id: employeeId,
        leave_type_id: typeId,
        start_date: startDate,
        end_date: durationMode === "full" ? endDate : startDate,
        half_day: durationMode === "half",
        working_days: workingDays,
        note: note || undefined,
      });
      setOpen(false);
      setNote("");
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="secondary">
            <UserPlus size={16} /> Zadat absenci za zaměstnance
          </Button>
        </DialogTrigger>
      )}
      <DialogContent title="Zadat absenci za zaměstnance">
        <div className="space-y-4">
          <p className="text-sm text-muted">Vytvoří se rovnou jako schválené — hodí se pro telefonicky nahlášenou nemoc apod.</p>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Zaměstnanec</label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Vyberte zaměstnance" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    {!t.active ? " (neaktivní)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {startDate === endDate && (selectedType?.allow_half_day !== false || selectedType?.allow_hours !== false) && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Délka trvání</label>
              <div className="flex gap-1 rounded border border-line p-1 text-sm">
                <button
                  onClick={() => setDurationMode("full")}
                  className={`flex-1 rounded px-3 py-1.5 ${durationMode === "full" ? "bg-teal text-white" : "text-muted"}`}
                >
                  Celý den
                </button>
                {selectedType?.allow_half_day !== false && (
                  <button
                    onClick={() => setDurationMode("half")}
                    className={`flex-1 rounded px-3 py-1.5 ${durationMode === "half" ? "bg-teal text-white" : "text-muted"}`}
                  >
                    Půlden
                  </button>
                )}
                {selectedType?.allow_hours !== false && (
                  <button
                    onClick={() => setDurationMode("hours")}
                    className={`flex-1 rounded px-3 py-1.5 ${durationMode === "hours" ? "bg-teal text-white" : "text-muted"}`}
                  >
                    Hodiny
                  </button>
                )}
              </div>
              {durationMode === "hours" && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={0.25}
                    max={dailyHours}
                    step={0.25}
                    value={hoursValue}
                    onChange={(e) => setHoursValue(Number(e.target.value))}
                    className="w-20 rounded border border-line px-2 py-1.5 text-center"
                  />
                  <span className="text-muted">hodin</span>
                </div>
              )}
            </div>
          )}

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
              <input
                type="date"
                value={endDate}
                disabled={durationMode !== "full"}
                onChange={(e) => {
                  const v = e.target.value;
                  setEndDate(v);
                  if (v < startDate) setStartDate(v);
                }}
                className="w-full rounded border border-line px-3 py-2 text-sm disabled:bg-paper"
              />
            </div>
          </div>

          <div className="rounded bg-paper px-3 py-2 text-sm text-ink">
            Celkem: <span className="font-medium">{workingDaysPhrase(workingDays)}</span>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Poznámka (volitelné)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            {workingDays <= 0 && <span className="mr-auto text-xs text-danger-dark">Termín nezahrnuje žádný pracovní den.</span>}
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !employeeId || !typeId || workingDays <= 0}>
              {submitting ? "Ukládám…" : "Zadat jako schválené"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
