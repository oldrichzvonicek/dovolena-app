"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { showToast } from "@/lib/toast";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { countWorkingDays, dayWord, formatRange, workingDaysPhrase } from "@/lib/working-days";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DbBlackoutPeriod, DbCompany, DbLeaveType, DbProfile } from "@/lib/supabase/types";
import { createLeaveRequest, fetchMaskedAbsences, updateLeaveRequest } from "@/lib/data";
import { fetchBlackoutPeriods, fetchCompany } from "@/lib/admin-data";
import { errorMessage } from "@/lib/utils";
import { loadBalances, remainingOf } from "@/lib/balances";
import { reducesPresence } from "@/lib/leave-kinds";

export interface EditingRequest {
  id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note: string | null;
  covering_profile_id: string | null;
}

type DurationMode = "full" | "half" | "hours";

/** Pre-fills a fresh (create-mode) request — from the CTA's per-type shortcuts, or from "Duplikovat" / "Upravit a poslat znovu" on an existing request (which always creates a new one: a rejected/approved request can't be edited in place). */
export interface PrefillRequest {
  leave_type_id?: string;
  half_day?: boolean;
  start_date?: string;
  end_date?: string;
  note?: string | null;
  covering_profile_id?: string | null;
}

interface RequestLeaveModalProps {
  onSaved?: () => void;
  /** Custom trigger element. Pass null to render no trigger at all (fully controlled via `open`/`onOpenChange`, e.g. from a calendar drag). Omit for the default "+ Nová žádost" button. */
  trigger?: React.ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  editingRequest?: EditingRequest;
  initialDates?: { start: string; end: string };
  prefill?: PrefillRequest;
}

export function RequestLeaveModal({
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  editingRequest,
  initialDates,
  prefill,
}: RequestLeaveModalProps) {
  const { profile } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange ?? (() => {}) : setInternalOpen;

  const isEditing = !!editingRequest;

  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [colleagues, setColleagues] = useState<DbProfile[]>([]);

  const [typeId, setTypeId] = useState<string>("");
  const [durationMode, setDurationMode] = useState<DurationMode>("full");
  const [hoursValue, setHoursValue] = useState(4);
  const [startDate, setStartDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [endDate, setEndDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [note, setNote] = useState("");
  const [coveringId, setCoveringId] = useState<string>("");
  const [conflict, setConflict] = useState<{ names: string[]; teamCount: number; teamSize: number } | null>(null);
  // Vlastní žádosti (schválené i čekající), které se překrývají s vybraným termínem.
  const [ownOverlap, setOwnOverlap] = useState<{ id: string; label: string; status: string; start_date: string; end_date: string; half_day: boolean; present: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [blackouts, setBlackouts] = useState<DbBlackoutPeriod[]>([]);
  const [remainingForType, setRemainingForType] = useState<number | null>(null);

  const selectedType = leaveTypes.find((t) => t.id === typeId);
  const privateType = !!selectedType && (selectedType.counts_against === "sick" || selectedType.hide_from_colleagues);
  // Stejné pravidlo jako v databázi: dvě nepřítomnosti se nesmí krýt (výjimka: dva půldny, a práce jako Home Office).
  const blockingOverlap = ownOverlap.filter((o) => !selectedType?.counts_as_present && !o.present && !(o.half_day && durationMode === "half"));

  useEffect(() => {
    if (!open || !profile) return;
    const supabase = createClient();
    supabase
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const rows = (data as DbLeaveType[]) ?? [];
        setLeaveTypes(rows);
        if (!isEditing && !prefill?.leave_type_id) {
          const firstActive = rows.find((t) => t.active) ?? rows[0];
          if (firstActive) setTypeId(firstActive.id);
        }
      });
    supabase
      .from("profiles")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .neq("id", profile.id)
      .then(({ data }) => setColleagues((data as DbProfile[]) ?? []));
    fetchCompany(profile.company_id).then(setCompany);
    fetchBlackoutPeriods(profile.company_id).then(setBlackouts);

    if (editingRequest) {
      setTypeId(editingRequest.leave_type_id);
      setStartDate(editingRequest.start_date);
      setEndDate(editingRequest.end_date);
      setNote(editingRequest.note ?? "");
      setCoveringId(editingRequest.covering_profile_id ?? "");
      if (editingRequest.half_day) {
        setDurationMode("half");
      } else if (
        editingRequest.start_date === editingRequest.end_date &&
        editingRequest.working_days !== countWorkingDays(editingRequest.start_date, editingRequest.end_date, company?.work_days)
      ) {
        setDurationMode("hours");
        setHoursValue(Math.round(editingRequest.working_days * (company?.standard_daily_hours ?? 8) * 4) / 4);
      } else {
        setDurationMode("full");
      }
    } else {
      const today = new Date().toLocaleDateString("sv-SE");
      if (prefill?.leave_type_id) setTypeId(prefill.leave_type_id);
      setDurationMode(prefill?.half_day ? "half" : "full");
      setStartDate(prefill?.start_date ?? initialDates?.start ?? today);
      setEndDate(prefill?.end_date ?? initialDates?.end ?? today);
      setNote(prefill?.note ?? "");
      // Prefill with the employee's default substitute (set in Nastavení firmy / Můj tým) — still editable per request.
      setCoveringId(prefill?.covering_profile_id ?? profile.substitute_id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  // A dragged/typed multi-day range can't be a half-day or hourly request.
  useEffect(() => {
    if (startDate !== endDate && durationMode !== "full") setDurationMode("full");
  }, [startDate, endDate, durationMode]);

  // The selected type may not allow the currently-picked duration mode.
  useEffect(() => {
    if (!selectedType) return;
    if (durationMode === "half" && !selectedType.allow_half_day) setDurationMode("full");
    if (durationMode === "hours" && !selectedType.allow_hours) setDurationMode("full");
  }, [selectedType, durationMode]);

  const dailyHours = company?.standard_daily_hours ?? 8;

  const workingDays = useMemo(() => {
    if (durationMode === "half") return 0.5;
    if (durationMode === "hours") return dailyHours > 0 ? Math.round((hoursValue / dailyHours) * 1000) / 1000 : 0;
    return countWorkingDays(startDate, endDate, company?.work_days);
  }, [startDate, endDate, durationMode, hoursValue, dailyHours, company?.work_days]);

  // "Team" = same department when the employee has one, otherwise the whole company.
  const team = useMemo(() => {
    if (!profile) return { colleagues: [] as DbProfile[], size: 1 };
    const mates = profile.department_id ? colleagues.filter((c) => c.department_id === profile.department_id) : colleagues;
    return { colleagues: mates, size: mates.length + 1 };
  }, [colleagues, profile]);

  // Remaining balance for the selected type's category (null when the type doesn't count against a balance).
  useEffect(() => {
    if (!profile || !open || !typeId) return;
    const type = leaveTypes.find((t) => t.id === typeId);
    if (!type || type.counts_against === "none") {
      setRemainingForType(null);
      return;
    }
    if (type.counts_against !== "vacation" && type.counts_against !== "sick") {
      setRemainingForType(null);
      return;
    }
    const cat = type.counts_against;
    (async () => {
      const balances = await loadBalances(profile.company_id, { profileId: profile.id, excludeRequestId: isEditing ? editingRequest!.id : undefined });
      setRemainingForType(remainingOf(balances.get(profile.id, cat)));
    })();
  }, [profile, open, typeId, leaveTypes, isEditing, editingRequest]);

  const today = new Date().toLocaleDateString("sv-SE");

  // Blocked-period is the one policy rule that's overridable (with an
  // explicit "odeslat i přesto" confirmation) rather than a hard stop — see
  // the CTA below. Everything else in policyError still blocks submission.
  const blackoutWarning = useMemo(() => {
    const blackout = blackouts.find((b) => b.start_date <= endDate && b.end_date >= startDate);
    return blackout ? `V termínu ${blackout.start_date} – ${blackout.end_date} je blokováno podávání žádostí (${blackout.label}).` : null;
  }, [blackouts, startDate, endDate]);
  const [overrideBlackout, setOverrideBlackout] = useState(false);

  useEffect(() => setOverrideBlackout(false), [blackoutWarning]);

  const policyError = useMemo(() => {
    if (workingDays <= 0) return "Vybraný termín nezahrnuje žádný pracovní den (víkend nebo státní svátek).";
    if (!company) return null;

    if (startDate < today) {
      if (!company.backdating_allowed) return "Zpětné zadávání absencí není v této firmě povoleno.";
      const daysBack = Math.round((new Date(today).getTime() - new Date(startDate).getTime()) / 86400000);
      if (daysBack > company.backdating_max_days) {
        return `Zpětně lze zadat maximálně ${company.backdating_max_days} ${dayWord(company.backdating_max_days)} — tento termín je ${daysBack} ${dayWord(daysBack)} zpět.`;
      }
    }

    if (workingDays > company.min_advance_threshold_days) {
      const daysAhead = Math.round((new Date(startDate).getTime() - new Date(today).getTime()) / 86400000);
      if (daysAhead < company.min_advance_days) {
        return `Absence delší než ${company.min_advance_threshold_days} dní je nutné podat min. ${company.min_advance_days} dní předem.`;
      }
    }

    if (remainingForType !== null) {
      const after = remainingForType - workingDays;
      if (after < 0 && (!company.allow_negative_balance || after < -company.max_negative_balance_days)) {
        return company.allow_negative_balance
          ? `Tato žádost by srazila zůstatek na ${after} dní — maximální povolený mínus je ${company.max_negative_balance_days} dní.`
          : `Na tuto absenci nemáte dostatečný zůstatek (zbývá ${remainingForType} dní).`;
      }
    }

    return null;
  }, [company, blackouts, startDate, endDate, workingDays, remainingForType, today]);

  // Does the person already have another request in this range? (a duplicate would count against the balance twice)
  useEffect(() => {
    if (!profile || !open || !startDate || !endDate || endDate < startDate) {
      setOwnOverlap([]);
      return;
    }
    let cancelled = false;
    let q = createClient()
      .from("leave_requests")
      .select("id, start_date, end_date, status, half_day, leave_type:leave_types(label, counts_as_present)")
      .eq("profile_id", profile.id)
      .in("status", ["approved", "pending"])
      .lte("start_date", endDate)
      .gte("end_date", startDate);
    if (isEditing) q = q.neq("id", editingRequest!.id);
    q.then(({ data }) => {
      if (cancelled) return;
      setOwnOverlap(
        ((data as unknown as { id: string; start_date: string; end_date: string; status: string; half_day: boolean; leave_type: { label: string; counts_as_present: boolean } | null }[]) ?? []).map((r) => ({
          id: r.id,
          label: r.leave_type?.label ?? "Absence",
          status: r.status,
          start_date: r.start_date,
          end_date: r.end_date,
          half_day: !!r.half_day,
          present: !!r.leave_type?.counts_as_present,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, profile, open, isEditing, editingRequest]);

  // Live collision check against everyone else's approved leave in the same range.
  useEffect(() => {
    if (!profile || !open) return;
    const supabase = createClient();
    let query = supabase
      .from("leave_requests")
      .select("profile_id, leave_type:leave_types(key), profile:profiles!leave_requests_profile_id_fkey(id, name)")
      .eq("status", "approved")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .neq("profile_id", profile.id);
    if (isEditing) query = query.neq("id", editingRequest!.id);

    Promise.all([query, fetchMaskedAbsences(startDate, endDate)]).then(([{ data }, masked]) => {
      const names = new Map(team.colleagues.map((c) => [c.id, c.name]));
      const hidden = masked
        .filter((m) => m.status === "approved" && m.profile_id !== profile.id && m.id !== editingRequest?.id)
        .map((m) => ({ profile_id: m.profile_id, leave_type: { key: "absent" }, profile: { id: m.profile_id, name: names.get(m.profile_id) ?? "" } }));
      const rows = [
        ...((data as unknown as { profile_id: string; leave_type: { key: string } | null; profile: { id: string; name: string } | null }[]) ?? []),
        ...hidden,
      ].filter((r) => reducesPresence(r.leave_type?.key) && reducesPresence(selectedType?.key));
      if (rows.length === 0) {
        setConflict(null);
        return;
      }
      const teamMateIds = new Set(team.colleagues.map((c) => c.id));
      const teamOverlap = rows.filter((r) => teamMateIds.has(r.profile_id));
      if (teamOverlap.length === 0) {
        setConflict(null);
        return;
      }
      setConflict({
        // Only team members, matching teamCount/teamSize below — showing
        // company-wide names here (unrelated headcount) is what produced
        // nonsense like "8 z 6 members" before.
        names: teamOverlap.map((r) => r.profile?.name).filter((n): n is string => !!n),
        teamCount: teamOverlap.length,
        teamSize: team.size,
      });
    });
  }, [startDate, endDate, profile, open, team, isEditing, editingRequest]);

  async function handleSubmit() {
    if (!profile || !typeId || policyError) return;
    if (blackoutWarning && !overrideBlackout) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        leave_type_id: typeId,
        start_date: startDate,
        end_date: durationMode === "full" ? endDate : startDate,
        half_day: durationMode === "half",
        working_days: workingDays,
        // Zdravotní údaje neevidujeme: u nemoci a soukromých typů se poznámka neukládá.
        note: privateType ? undefined : note || undefined,
        covering_profile_id: coveringId || null,
      };
      const autoApproved =
        selectedType?.requires_approval === false ||
        (selectedType?.auto_approve_max_days != null && workingDays <= Number(selectedType.auto_approve_max_days));
      if (isEditing) {
        await updateLeaveRequest(editingRequest!.id, payload);
      } else {
        await createLeaveRequest({
          profile_id: profile.id,
          ...payload,
          status: autoApproved ? "approved" : "pending",
        });
      }
      showToast(
        isEditing
          ? "Změny žádosti jsou uložené."
          : autoApproved
            ? "Absence je zapsaná a schválená automaticky."
            : "Žádost byla odeslána ke schválení. Dáme vám vědět, jakmile ji schvalovatel vyřídí.",
        "success"
      );
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  const dialog = (
    <DialogContent title={isEditing ? "Upravit žádost o absenci" : "Nová žádost o absenci"}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Typ absence</label>
          <Select value={typeId} onValueChange={setTypeId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leaveTypes
                .filter((t) => t.active || t.id === typeId)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
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
                <span className="text-muted">hodin (ze standardního úvazku {dailyHours} h/den)</span>
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
          Celkem: <span className="font-medium">{workingDaysPhrase(workingDays)}</span>{" "}
          <span className="text-muted">— víkendy a státní svátky odečteny automaticky</span>
        </div>

        {blockingOverlap.length > 0 && (
          <div className="flex items-start gap-2 rounded border border-danger/40 bg-danger-light px-3 py-2 text-sm text-danger-dark" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              <strong>V tomto termínu už máte jinou absenci:</strong>{" "}
              {blockingOverlap.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && "; "}
                  {o.label} {formatRange(o.start_date, o.end_date)} ({o.status === "approved" ? "schváleno" : "čeká na schválení"})
                </span>
              ))}
              . Ve stejný den nejde mít dvě absence. Zvolte jiný termín, nebo původní žádost upravte či zrušte v Moje žádosti.
            </span>
          </div>
        )}

        {ownOverlap.length > 0 && blockingOverlap.length === 0 && (
          <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning-light px-3 py-2 text-sm text-ink" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-dark" />
            <span>
              V tomto termínu už máte jinou žádost:{" "}
              {ownOverlap.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && "; "}
                  <strong>{o.label}</strong> {formatRange(o.start_date, o.end_date)} ({o.status === "approved" ? "schváleno" : "čeká na schválení"})
                </span>
              ))}
              . Půldny se mohou sejít v jednom dni a práce z domu se s absencí nevylučuje.
            </span>
          </div>
        )}

        {conflict && conflict.teamCount > 0 && (
          <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning-light px-3 py-2 text-sm text-ink">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning-dark" />
            <span>
              Ve stejném termínu chybí <strong>{conflict.teamCount} z {conflict.teamSize}</strong> členů vašeho
              týmu: {conflict.names.slice(0, 3).join(", ")}
              {conflict.names.length > 3 ? ` a další` : ""}.
            </span>
          </div>
        )}

        {privateType ? (
          <p className="rounded border border-line bg-paper px-3 py-2 text-sm text-muted">
            U nemoci a soukromých absencí žádné důvody ani zdravotní údaje neevidujeme — stačí odeslat termín.
          </p>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Poznámka pro manažera (volitelné)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              placeholder="Např. důvod žádosti" aria-label="Např. důvod žádosti"
            />
            <p className="mt-1 text-xs text-muted">Neuvádějte zdravotní údaje.</p>
          </div>
        )}

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

        {blackoutWarning && (
          <div className="rounded border border-warning/30 bg-warning-light px-3 py-2 text-sm text-warning-dark">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{blackoutWarning}</span>
            </div>
            <label className="mt-2 flex items-center gap-2 pl-6 text-sm">
              <input type="checkbox" checked={overrideBlackout} onChange={(e) => setOverrideBlackout(e.target.checked)} className="h-4 w-4 accent-warning" />
              Odeslat i přesto — nadřízený uvidí, že jde o blokovaný termín.
            </label>
          </div>
        )}

        {policyError && (
          <div className="flex items-start gap-2 rounded border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{policyError}</span>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !typeId || !!policyError || blockingOverlap.length > 0 || (!!blackoutWarning && !overrideBlackout)}
          >
            {submitting ? "Odesílám…" : isEditing ? "Uložit změny" : blackoutWarning ? "Odeslat i přesto" : "Odeslat ke schválení"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  if (trigger === null) {
    // Fully controlled, no visible trigger (e.g. opened by a calendar drag-select).
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="primary">
            <Plus size={18} /> Nová žádost o absenci
          </Button>
        )}
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
