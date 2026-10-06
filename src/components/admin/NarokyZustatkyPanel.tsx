"use client";

import { AlertTriangle, CalendarClock, Gift } from "lucide-react";
import { useCompanyDraft } from "@/lib/use-company-draft";
import { Switch } from "@/components/ui/switch";
import { OptionalNumber, UnitInput } from "@/components/ui/optional-number";
import { FeatureGate } from "@/components/shared/FeatureGate";
import { SeniorityCard } from "@/components/admin/SeniorityCard";
import { SectionHeader } from "@/components/admin/section-header";
import { DraftSaveBar } from "@/components/shared/DraftSaveBar";
import { LoadingCard } from "@/components/ui/skeleton";

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Month + day pickers storing "MM-DD" — no typing of separators. */
function MonthDayPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [mm, dd] = value ? value.split("-") : ["", ""];
  const month = mm ? Number(mm) : 0;
  const day = dd ? Number(dd) : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        aria-label="Měsíc expirace"
        value={month || ""}
        onChange={(e) => {
          const m = Number(e.target.value);
          if (!m) return onChange(null);
          onChange(`${pad(m)}-${pad(Math.min(day || 1, DAYS_IN_MONTH[m - 1]))}`);
        }}
        className="rounded border border-line bg-white px-3 py-2 text-sm"
      >
        <option value="">Nikdy nepropadá</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      {month > 0 && (
        <select
          aria-label="Den expirace"
          value={day || 1}
          onChange={(e) => onChange(`${pad(month)}-${pad(Number(e.target.value))}`)}
          className="rounded border border-line bg-white px-3 py-2 text-sm"
        >
          {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}.
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** Životní cyklus dovolené: nárok → úprava během roku → čerpání → konec roku. Vše na jednom místě — dřív bylo
 *  rozdělené mezi Typy absencí (výchozí nároky) a Kalendář a provoz (převod, mínus). */
export function NarokyZustatkyPanel() {
  const { company, loading, patch, dirty, resetToken, cancel, save, saveStatus, saveError } = useCompanyDraft();

  if (loading || !company) return <LoadingCard rows={8} />;

  return (
    <div className="max-w-[720px] space-y-4">
      <div key={resetToken} className="card p-5">
        <SectionHeader icon={<Gift size={15} />} title="Výchozí roční nárok" className="bg-teal-light text-teal-dark" />
        <p className="mt-1 text-sm text-muted">
          Použije se při pozvání nového zaměstnance (odkazem) nebo založení firmy. Existujícím lidem se dá nárok upravit v Lidé.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Dovolená / rok</label>
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={company.default_vacation_days}
              onBlur={(e) => patch({ default_vacation_days: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Sick days / rok</label>
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={company.default_sick_days}
              onBlur={(e) => patch({ default_sick_days: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Home Office / rok</label>
            <OptionalNumber
              enabled={company.default_home_office_days !== 0}
              onToggle={(on) => patch({ default_home_office_days: on ? 60 : 0 })}
              value={company.default_home_office_days === 0 ? null : company.default_home_office_days}
              onCommit={(n) => patch({ default_home_office_days: n })}
              unit="dní"
              step={0.5}
              offLabel="Bez omezení"
              onLabel="Nejvýše"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <Switch checked={company.prorate_new_hires} onCheckedChange={(v) => patch({ prorate_new_hires: v })} label="Poměrná dovolená pro nováčky během roku" />
          Poměrná dovolená pro nováčky během roku (krátí se podle měsíce nástupu — je-li vyplněné datum nástupu, jinak podle dne založení účtu)
        </div>
      </div>

      <FeatureGate feature="seniority" description="Automatický příplatek k ročnímu nároku podle počtu let ve firmě.">
        <SeniorityCard companyId={company.id} enabled={company.seniority_enabled ?? false} rules={company.seniority_rules ?? []} defaultVacation={company.default_vacation_days} />
      </FeatureGate>

      <div key={`neg-${resetToken}`} className="card p-5">
        <SectionHeader icon={<AlertTriangle size={15} />} title="Čerpání do mínusu" className="bg-danger-light text-danger" />
        <div className="mt-4 flex items-center justify-between gap-4 rounded border border-line p-4">
          <div>
            <div className="text-sm font-medium">Povolit čerpání do mínusu</div>
            <p className="mt-0.5 text-sm text-muted">Povolit žádost i bez dostatečného zůstatku, do zadaného limitu.</p>
            {company.allow_negative_balance && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                Nejvýše
                <UnitInput unit="dní do mínusu" min={0} step={0.5} defaultValue={company.max_negative_balance_days} aria-label="Kolik dní do mínusu" onBlur={(e) => patch({ max_negative_balance_days: Number(e.target.value) })} className="[&_input]:w-14" />
              </div>
            )}
          </div>
          <Switch checked={company.allow_negative_balance} onCheckedChange={(v) => patch({ allow_negative_balance: v })} label="Čerpání do mínusu" />
        </div>
      </div>

      <div key={`carry-${resetToken}`} className="card p-5">
        <SectionHeader icon={<CalendarClock size={15} />} title="Převod a expirace dovolené" />
        <p className="mt-1 text-sm text-muted">
          Nevyčerpaná dovolená z minulého roku propadne k tomuto datu, nebo zvolte „Nikdy nepropadá“.
        </p>
        <MonthDayPicker value={company.carryover_expiry_md} onChange={(v) => patch({ carryover_expiry_md: v })} />

        <div className="mt-3 border-t border-line pt-3">
          <div className="text-sm font-medium">Maximální počet dní k převodu</div>
          <p className="mt-0.5 mb-2 text-sm text-muted">Kolik nevyčerpaných dní si zaměstnanec smí přenést do dalšího roku.</p>
          <OptionalNumber
            enabled={company.max_carryover_days !== null}
            onToggle={(on) => patch({ max_carryover_days: on ? 5 : null })}
            value={company.max_carryover_days}
            onCommit={(n) => patch({ max_carryover_days: n })}
            unit="dní"
            step={0.5}
            offLabel="Bez omezení: převede se všechno"
            onLabel="Přenést nejvýše"
          />
        </div>
      </div>

      <DraftSaveBar dirty={dirty} status={saveStatus} error={saveError} onSave={save} onCancel={cancel} />
    </div>
  );
}
