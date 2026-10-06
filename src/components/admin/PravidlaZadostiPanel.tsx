"use client";

import { CalendarOff } from "lucide-react";
import { useCompanyDraft } from "@/lib/use-company-draft";
import { Switch } from "@/components/ui/switch";
import { UnitInput } from "@/components/ui/optional-number";
import { SectionHeader } from "@/components/admin/section-header";
import { DraftSaveBar } from "@/components/shared/DraftSaveBar";
import { LoadingCard } from "@/components/ui/skeleton";

/** Výchozí firemní pravidla pro podání žádosti — jednotlivý typ absence je smí v Typy absencí přepsat vlastními. */
export function PravidlaZadostiPanel() {
  const { company, loading, patch, dirty, resetToken, cancel, save, saveStatus, saveError } = useCompanyDraft();

  if (loading || !company) return <LoadingCard rows={8} />;

  return (
    <div className="max-w-[720px] space-y-4">
      <div key={resetToken} className="card p-5">
        <SectionHeader icon={<CalendarOff size={15} />} title="Pravidla pro žádosti" className="bg-warning-light text-warning-dark" />

        <div className="mt-4 space-y-4">
          <div className="rounded border border-line p-4">
            <div className="text-sm font-medium">Minimální předstih pro delší dovolenou</div>
            <p className="mt-0.5 text-sm text-muted">Žádosti delší než zadaný počet dní je nutné podat s předstihem.</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Délka od</span>
                <UnitInput unit="dní" min={0} step={0.5} defaultValue={company.min_advance_threshold_days} aria-label="Délka dovolené od které platí předstih" onBlur={(e) => patch({ min_advance_threshold_days: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Předstih</span>
                <UnitInput unit="dní" min={0} defaultValue={company.min_advance_days} aria-label="Minimální předstih ve dnech" onBlur={(e) => patch({ min_advance_days: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded border border-line p-4">
            <div>
              <div className="text-sm font-medium">Zpětné zadávání absencí</div>
              <p className="mt-0.5 text-sm text-muted">Povolit žádosti se začátkem v minulosti (např. dodatečné nahlášení nemoci).</p>
              {company.backdating_allowed && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  Nejvýše
                  <UnitInput unit="dní zpětně" min={0} defaultValue={company.backdating_max_days} aria-label="Kolik dní zpětně" onBlur={(e) => patch({ backdating_max_days: Number(e.target.value) })} className="[&_input]:w-14" />
                </div>
              )}
            </div>
            <Switch checked={company.backdating_allowed} onCheckedChange={(v) => patch({ backdating_allowed: v })} label="Zpětné zadávání absencí" />
          </div>
        </div>
      </div>

      <DraftSaveBar dirty={dirty} status={saveStatus} error={saveError} onSave={save} onCancel={cancel} />
    </div>
  );
}
