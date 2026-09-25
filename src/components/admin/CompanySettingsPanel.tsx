"use client";

import { confirmDialog } from "@/components/shared/ConfirmHost";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, CalendarOff, CheckCircle2, Settings, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  createBlackoutPeriod,
  createCompanyWideLeave,
  deleteBlackoutPeriod,
  fetchBlackoutPeriods,
  fetchCompany,
  updateCompany,
} from "@/lib/admin-data";
import { fetchDepartments, fetchLeaveTypes } from "@/lib/data";
import { countWorkingDays, dayWord } from "@/lib/working-days";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DbBlackoutPeriod, DbCompany, DbDepartment, DbLeaveType, ShiftPattern } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";

const shiftLabel: Record<ShiftPattern, string> = {
  none: "Jednosměnný (standardní pracovní doba)",
  two_shift: "Dvousměnný provoz",
  three_shift: "Třísměnný provoz",
};

const weekDays = [
  { iso: 1, label: "Po" },
  { iso: 2, label: "Út" },
  { iso: 3, label: "St" },
  { iso: 4, label: "Čt" },
  { iso: 5, label: "Pá" },
  { iso: 6, label: "So" },
  { iso: 7, label: "Ne" },
];

function SectionHeader({ icon, title, className }: { icon: React.ReactNode; title: string; className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className ?? "bg-moss-light text-moss-dark"}`}>
        {icon}
      </div>
      <h2 className="font-display text-h2">{title}</h2>
    </div>
  );
}

export function CompanySettingsPanel() {
  const { profile } = useAuth();
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [blackouts, setBlackouts] = useState<DbBlackoutPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!profile) return;
    const [c, lt, bp] = await Promise.all([
      fetchCompany(profile.company_id),
      fetchLeaveTypes(profile.company_id),
      fetchBlackoutPeriods(profile.company_id),
    ]);
    setCompany(c);
    setLeaveTypes(lt);
    setBlackouts(bp);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function patch(fields: Partial<DbCompany>) {
    if (!profile || !company) return;
    setCompany({ ...company, ...fields });
    await updateCompany(profile.company_id, fields);
  }

  function toggleWorkDay(iso: number) {
    if (!company) return;
    const has = company.work_days.includes(iso);
    const next = has ? company.work_days.filter((d) => d !== iso) : [...company.work_days, iso].sort();
    patch({ work_days: next });
  }

  if (loading || !company) return <div className="card p-8 text-center text-sm text-muted">Načítám…</div>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <SectionHeader icon={<Settings size={15} />} title="Kalendář a směny" />

        <label className="mt-4 flex items-center justify-between gap-4 rounded border border-line p-4">
          <div>
            <div className="text-sm font-medium">Víkendový provoz</div>
            <p className="mt-0.5 text-sm text-muted">
              Když je vypnuto, týmový kalendář soboty a neděle vůbec nezobrazuje — nezabírají zbytečně místo.
            </p>
          </div>
          <input
            type="checkbox"
            checked={company.weekend_operations}
            onChange={(e) => patch({ weekend_operations: e.target.checked })}
            className="h-5 w-5 shrink-0 rounded border-line accent-teal"
          />
        </label>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Směnný provoz</label>
            <Select value={company.shift_pattern} onValueChange={(v) => patch({ shift_pattern: v as ShiftPattern })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(shiftLabel) as ShiftPattern[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {shiftLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Standardní úvazek (hodin/den)</label>
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              defaultValue={company.standard_daily_hours}
              onBlur={(e) => patch({ standard_daily_hours: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Základ pro budoucí přepočet půldnů a hodinových absencí. Zatím se dny stále počítají jako celé pracovní dny.
        </p>

        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-medium">Pracovní dny</label>
          <div className="flex gap-1.5">
            {weekDays.map((d) => (
              <button
                key={d.iso}
                onClick={() => toggleWorkDay(d.iso)}
                className={`h-9 w-9 rounded border text-sm font-medium ${
                  company.work_days.includes(d.iso) ? "border-teal bg-teal-light text-teal-dark" : "border-line text-muted hover:bg-paper"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <SectionHeader icon={<CalendarOff size={15} />} title="Pravidla pro žádosti" className="bg-warning-light text-warning-dark" />

        <div className="mt-4 space-y-4">
          <div className="rounded border border-line p-4">
            <div className="text-sm font-medium">Minimální předstih</div>
            <p className="mt-0.5 text-sm text-muted">
              Žádosti delší než zadaný počet dní je nutné podat s předstihem.
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm">
              Dovolenou delší než
              <input
                type="number"
                min={0}
                step={0.5}
                defaultValue={company.min_advance_threshold_days}
                onBlur={(e) => patch({ min_advance_threshold_days: Number(e.target.value) })}
                className="w-16 rounded border border-line px-2 py-1 text-center"
              />
              dní je nutné zadat min.
              <input
                type="number"
                min={0}
                defaultValue={company.min_advance_days}
                onBlur={(e) => patch({ min_advance_days: Number(e.target.value) })}
                className="w-16 rounded border border-line px-2 py-1 text-center"
              />
              dní předem.
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded border border-line p-4">
            <div>
              <div className="text-sm font-medium">Zpětné zadávání absencí</div>
              <p className="mt-0.5 text-sm text-muted">
                Povolit žádosti se začátkem v minulosti (např. dodatečné nahlášení nemoci).
              </p>
              {company.backdating_allowed && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  Max.
                  <input
                    type="number"
                    min={0}
                    defaultValue={company.backdating_max_days}
                    onBlur={(e) => patch({ backdating_max_days: Number(e.target.value) })}
                    className="w-16 rounded border border-line px-2 py-1 text-center"
                  />
                  dní zpětně.
                </div>
              )}
            </div>
            <input
              type="checkbox"
              checked={company.backdating_allowed}
              onChange={(e) => patch({ backdating_allowed: e.target.checked })}
              className="h-5 w-5 shrink-0 rounded border-line accent-teal"
            />
          </label>

          <label className="flex items-center justify-between gap-4 rounded border border-line p-4">
            <div>
              <div className="text-sm font-medium">Čerpání do mínusu</div>
              <p className="mt-0.5 text-sm text-muted">Povolit žádost i bez dostatečného zůstatku, do zadaného limitu.</p>
              {company.allow_negative_balance && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  Max.
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    defaultValue={company.max_negative_balance_days}
                    onBlur={(e) => patch({ max_negative_balance_days: Number(e.target.value) })}
                    className="w-16 rounded border border-line px-2 py-1 text-center"
                  />
                  dní do mínusu.
                </div>
              )}
            </div>
            <input
              type="checkbox"
              checked={company.allow_negative_balance}
              onChange={(e) => patch({ allow_negative_balance: e.target.checked })}
              className="h-5 w-5 shrink-0 rounded border-line accent-teal"
            />
          </label>

          <div className="rounded border border-line p-4">
            <div className="text-sm font-medium">Převod a expirace dovolené</div>
            <p className="mt-0.5 text-sm text-muted">
              Nevyčerpaná dovolená z minulého roku propadne k tomuto datu (prázdné = nikdy nepropadá).
            </p>
            <input
              type="text"
              placeholder="MM-DD, např. 06-30" aria-label="MM-DD, např. 06-30"
              pattern="\d{2}-\d{2}"
              defaultValue={company.carryover_expiry_md ?? ""}
              onBlur={(e) => patch({ carryover_expiry_md: e.target.value.trim() || null })}
              className="mt-2 w-40 rounded border border-line px-3 py-2 text-sm"
            />

            <div className="mt-3 border-t border-line pt-3">
              <div className="text-sm font-medium">Maximální počet dní k převodu</div>
              <p className="mt-0.5 text-sm text-muted">
                Kolik nevyčerpaných dní si zaměstnanec smí přenést do dalšího roku nejvýš (prázdné = bez omezení,
                převede se vše).
              </p>
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="Bez omezení" aria-label="Bez omezení"
                defaultValue={company.max_carryover_days ?? ""}
                onBlur={(e) => patch({ max_carryover_days: e.target.value ? Number(e.target.value) : null })}
                className="mt-2 w-32 rounded border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <SectionHeader icon={<AlertTriangle size={15} />} title="Kapacita a upozornění" className="bg-danger-light text-danger" />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kapacitní varování (% oddělení)</label>
            <input
              type="number"
              min={1}
              max={100}
              defaultValue={company.capacity_warning_percent}
              onBlur={(e) => patch({ capacity_warning_percent: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">Manažer uvidí varování, pokud by schválení přesáhlo tento podíl oddělení.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Připomínka schvalovateli (hodin)</label>
            <input
              type="number"
              min={0}
              placeholder="Vypnuto" aria-label="Vypnuto"
              defaultValue={company.approval_reminder_hours ?? ""}
              onBlur={(e) => patch({ approval_reminder_hours: e.target.value ? Number(e.target.value) : null })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">
              Zatím se jen ukládá — automatický e-mail vyžaduje napojení e-mailového providera, což je samostatný krok.
            </p>
          </div>
        </div>
      </div>

      <BlackoutPeriodsSection companyId={profile!.company_id} blackouts={blackouts} onReload={load} />

      <CompanyWideLeaveSection companyId={profile!.company_id} leaveTypes={leaveTypes} />
    </div>
  );
}

function BlackoutPeriodsSection({
  companyId,
  blackouts,
  onReload,
}: {
  companyId: string;
  blackouts: DbBlackoutPeriod[];
  onReload: () => void;
}) {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!label.trim() || !start || !end) return;
    setError(null);
    try {
      await createBlackoutPeriod(companyId, { label: label.trim(), start_date: start, end_date: end });
      setLabel("");
      setStart("");
      setEnd("");
      onReload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleDelete(id: string) {
    await deleteBlackoutPeriod(id);
    onReload();
  }

  return (
    <div className="card p-5">
      <SectionHeader icon={<Ban size={15} />} title="Blokované termíny" className="bg-danger-light text-danger" />
      <p className="mt-1 text-sm text-muted">
        Během těchto dat nejde podat běžnou žádost o absenci (např. celofiremní inventura, uzávěrka).
      </p>

      {blackouts.length > 0 && (
        <div className="mt-4 space-y-2">
          {blackouts.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded border border-line p-3 text-sm">
              <div>
                <span className="font-medium">{b.label}</span>{" "}
                <span className="text-muted">
                  {b.start_date} – {b.end_date}
                </span>
              </div>
              <button onClick={() => handleDelete(b.id)} className="rounded p-1.5 text-muted hover:bg-danger-light hover:text-danger">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Popis</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Např. Roční inventura" aria-label="Např. Roční inventura"
            className="w-48 rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Od</label>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              if (end && v > end) setEnd(v);
            }}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Do</label>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              const v = e.target.value;
              setEnd(v);
              if (start && v < start) setStart(v);
            }}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <Button variant="secondary" onClick={handleAdd} disabled={!label.trim() || !start || !end}>
          Zablokovat termín
        </Button>
      </div>
    </div>
  );
}

function CompanyWideLeaveSection({ companyId, leaveTypes }: { companyId: string; leaveTypes: DbLeaveType[] }) {
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchDepartments(companyId).then(setDepartments);
  }, [companyId]);

  // Celozávodní dovolená books actual paid vacation only — it's not a
  // general-purpose absence type, so there's nothing for the admin to pick.
  const vacationType = leaveTypes.find((t) => t.key === "dovolena");
  const workingDays = start && end ? countWorkingDays(start, end) : 0;

  function toggleDept(id: string) {
    setSelectedDeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!vacationType || !start || !end) return;
    if (scope === "selected" && selectedDeptIds.size === 0) return;
    const targetLabel = scope === "all" ? "ÚPLNĚ VŠECHNY zaměstnance firmy" : `zaměstnance ${selectedDeptIds.size} vybraných oddělení`;
    if (!(await confirmDialog(`Opravdu naplánovat schválenou dovolenou pro ${targetLabel} (${start} – ${end})? Nejde to hromadně vzít zpět.`, { confirmLabel: "Naplánovat" }))) return;
    setSubmitting(true);
    setResult(null);
    try {
      const n = await createCompanyWideLeave(companyId, {
        leave_type_id: vacationType.id,
        start_date: start,
        end_date: end,
        working_days: workingDays,
        note: note || "Celozávodní dovolená",
        department_ids: scope === "selected" ? Array.from(selectedDeptIds) : null,
      });
      setResult({ ok: true, text: `Úspěšně naplánováno pro ${n} zaměstnanců.` });
      setStart("");
      setEnd("");
      setNote("");
    } catch (e) {
      setResult({ ok: false, text: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-5">
      <SectionHeader icon={<CheckCircle2 size={15} />} title="Celozávodní dovolená" />
      <p className="mt-1 text-sm text-muted">
        Naplánuje schválenou dovolenou rovnou všem (nebo vybraným) zaměstnancům firmy (např. vánoční odstávka) — u
        každého se rovnou odečte ze zůstatku.
      </p>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted">Komu</label>
        <div className="flex gap-1 rounded border border-line p-1 text-sm w-fit">
          <button
            onClick={() => setScope("all")}
            className={`rounded px-3 py-1.5 ${scope === "all" ? "bg-teal-dark text-white" : "text-muted"}`}
          >
            Celá firma
          </button>
          <button
            onClick={() => setScope("selected")}
            className={`rounded px-3 py-1.5 ${scope === "selected" ? "bg-teal-dark text-white" : "text-muted"}`}
          >
            Vybraná oddělení
          </button>
        </div>
        {scope === "selected" && (
          <div className="mt-2 flex flex-wrap gap-2">
            {departments.length === 0 && <p className="text-sm text-muted">Firma zatím nemá žádná oddělení.</p>}
            {departments.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-sm has-[:checked]:border-teal-dark has-[:checked]:bg-teal-light"
              >
                <input type="checkbox" checked={selectedDeptIds.has(d.id)} onChange={() => toggleDept(d.id)} className="accent-teal-dark" />
                {d.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Od</label>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              if (end && v > end) setEnd(v);
            }}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Do</label>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              const v = e.target.value;
              setEnd(v);
              if (start && v < start) setStart(v);
            }}
            className="rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Poznámka</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Vánoční odstávka" aria-label="Vánoční odstávka"
            className="w-48 rounded border border-line px-3 py-2 text-sm"
          />
        </div>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={submitting || !start || !end || !vacationType || (scope === "selected" && selectedDeptIds.size === 0)}
        >
          {submitting ? "Plánuji…" : `Naplánovat ${workingDays > 0 ? `(${workingDays} ${dayWord(workingDays)})` : ""}`}
        </Button>
      </div>

      {result && <p className={`mt-3 text-sm ${result.ok ? "text-teal-dark" : "text-danger"}`}>{result.text}</p>}
    </div>
  );
}
