"use client";

import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Settings, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { useAuth } from "@/lib/auth-context";
import { createCompanyWideLeave, createBlackoutPeriod, deleteBlackoutPeriod, fetchBlackoutPeriods } from "@/lib/admin-data";
import { fetchDepartments, fetchLeaveTypes } from "@/lib/data";
import { countWorkingDays, dayWord } from "@/lib/working-days";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCompanyDraft } from "@/lib/use-company-draft";
import { DbBlackoutPeriod, DbDepartment, DbLeaveType, ShiftPattern } from "@/lib/supabase/types";
import { errorMessage, formatNumber } from "@/lib/utils";
import { UnitInput } from "@/components/ui/optional-number";
import { SectionHeader } from "@/components/admin/section-header";
import { DraftSaveBar } from "@/components/shared/DraftSaveBar";
import { LoadingCard } from "@/components/ui/skeleton";

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

/** Roční pás s vyznačenými blokovanými termíny: rychlá vizuální kontrola, kdy se nedá žádat. */
function YearStrip({ ranges }: { ranges: { label: string; start: string; end: string }[] }) {
  const year = new Date().getFullYear();
  const t0 = Date.UTC(year, 0, 1);
  const total = Date.UTC(year + 1, 0, 1) - t0;
  const pct = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso + "T00:00:00Z") - t0) / total) * 100));
  const now = ((Date.now() - t0) / total) * 100;
  return (
    <div className="mt-4">
      <div className="mb-1 text-xs font-medium text-muted">Přehled roku {year}</div>
      <div className="relative h-6 rounded bg-paper">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="absolute top-0 h-full border-l border-line/70" style={{ left: `${(i / 12) * 100}%` }} />
        ))}
        {ranges.map((r) => {
          const l = pct(r.start);
          const w = Math.max(0.8, pct(r.end) - l + 0.3);
          return <span key={r.label + r.start} title={`${r.label}: ${r.start} – ${r.end}`} className="absolute top-1 h-4 rounded-sm bg-danger/70" style={{ left: `${l}%`, width: `${w}%` }} />;
        })}
        {now >= 0 && now <= 100 && <span className="absolute top-0 h-full w-0.5 bg-sky-dark" style={{ left: `${now}%` }} title="Dnes" />}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted">
        {["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

/** Pracovní dny, hodiny a firemní události (blokované termíny + celozávodní dovolená) — dřív tři různé záložky. */
export function PracovniKalendarPanel() {
  const { profile } = useAuth();
  const { company, loading, patch, dirty, resetToken, cancel, save, saveStatus, saveError } = useCompanyDraft();
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [blackouts, setBlackouts] = useState<DbBlackoutPeriod[]>([]);

  async function loadEvents() {
    if (!profile) return;
    const [lt, bp] = await Promise.all([fetchLeaveTypes(profile.company_id), fetchBlackoutPeriods(profile.company_id)]);
    setLeaveTypes(lt);
    setBlackouts(bp);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function toggleWorkDay(iso: number) {
    if (!company) return;
    const has = company.work_days.includes(iso);
    const next = has ? company.work_days.filter((d) => d !== iso) : [...company.work_days, iso].sort();
    patch({ work_days: next });
  }

  if (loading || !company) return <LoadingCard rows={8} />;

  return (
    <div className="max-w-[720px] space-y-4">
      <div key={resetToken} className="card p-5">
        <SectionHeader icon={<Settings size={15} />} title="Pracovní doba" />

        <div className="mt-4 flex items-center justify-between gap-4 rounded border border-line p-4">
          <div>
            <div className="text-sm font-medium">Víkendový provoz</div>
            <p className="mt-0.5 text-sm text-muted">
              Když je vypnuto, týmový kalendář soboty a neděle vůbec nezobrazuje — nezabírají zbytečně místo.
            </p>
          </div>
          <Switch checked={company.weekend_operations} onCheckedChange={(v) => patch({ weekend_operations: v })} label="Víkendový provoz" />
        </div>

        <div className="mt-3">
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
          <p className="mt-1.5 text-xs text-muted">Zatím jen informativní, nikde se s ním nepočítá.</p>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <div className="text-sm font-medium">Týdenní pracovní rozvrh</div>
          <p className="mt-0.5 text-sm text-muted">
            Pracovní dny se používají při výpočtu počtu dní absence (kolik dní se strhne ze zůstatku). Hodiny za den jsou zatím jen informativní (zobrazí se ve statistikách, na absenci v celých dnech vliv nemají).
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Pracovní dny</label>
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Hodin za den</label>
              <UnitInput unit="hodin / den" min={1} max={24} step={0.5} defaultValue={company.standard_daily_hours} aria-label="Standardní úvazek v hodinách za den" onBlur={(e) => patch({ standard_daily_hours: Number(e.target.value) })} className="[&_input]:w-16" />
            </div>
            <p className="pb-2 text-sm text-muted">
              = {formatNumber(company.work_days.length * company.standard_daily_hours)} h týdně ({company.work_days.length} {dayWord(company.work_days.length)})
            </p>
          </div>
        </div>
      </div>

      <DraftSaveBar dirty={dirty} status={saveStatus} error={saveError} onSave={save} onCancel={cancel} />

      <BlackoutPeriodsSection companyId={profile!.company_id} blackouts={blackouts} onReload={loadEvents} />

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

      <YearStrip ranges={blackouts.map((b) => ({ label: b.label, start: b.start_date, end: b.end_date }))} />

      {blackouts.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">Naplánované blokace ({blackouts.length})</div>
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

      <div className="mt-4 rounded-lg border border-line bg-paper p-4">
        <div className="mb-3 text-sm font-medium">Nová blokace</div>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Popis</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Např. Roční inventura" aria-label="Např. Roční inventura"
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
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
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
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
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
          />
        </div>
        <Button variant="primary" onClick={handleAdd} disabled={!label.trim() || !start || !end}>
          Zablokovat termín
        </Button>
        </div>
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
        každého se rovnou odečte ze zůstatku. Přeskočí neaktivní lidi a ty, kdo mají v tomto termínu už jinou absenci
        (dny by se jim odečetly dvakrát).
      </p>

      <div className="mt-4 rounded-lg border border-line bg-paper p-4">
      <div className="mb-3 text-sm font-medium">Nová celozávodní dovolená</div>
      <div>
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

      <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
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
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
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
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
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

      </div>

      {result && <p className={`mt-3 text-sm ${result.ok ? "text-teal-dark" : "text-danger"}`}>{result.text}</p>}
    </div>
  );
}
