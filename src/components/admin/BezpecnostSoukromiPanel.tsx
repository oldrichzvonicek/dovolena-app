"use client";

import { ShieldCheck } from "lucide-react";
import { useCompanyDraft } from "@/lib/use-company-draft";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/admin/section-header";
import { DraftSaveBar } from "@/components/shared/DraftSaveBar";
import { LoadingCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Kdo se musí dvoufázově ověřit, jak se schvaluje a kdo co z absencí kolegů vidí. */
export function BezpecnostSoukromiPanel() {
  const { company, loading, patch, dirty, resetToken, cancel, save, saveStatus, saveError } = useCompanyDraft();

  if (loading || !company) return <LoadingCard rows={8} />;

  return (
    <div className="max-w-[720px] space-y-4">
      <div key={resetToken} className="card p-5">
        <SectionHeader icon={<ShieldCheck size={15} />} title="Bezpečnost a soukromí" />
        <div className="mt-4 flex items-center justify-between gap-4 rounded border border-line p-4">
          <div>
            <div className="text-sm font-medium">Vyžadovat dvoufázové ověření pro admina, HR a účetní</div>
            <p className="mt-0.5 text-sm text-muted">
              Tito lidé vidí data všech kolegů. Když je volba zapnutá, musí si nastavit ověřovací aplikaci (Můj účet), jinak se do aplikace nedostanou. Ostatní zaměstnanci si 2FA mohou zapnout dobrovolně.
            </p>
          </div>
          <Switch
            checked={company.require_mfa_staff === true}
            onCheckedChange={(v) => patch(v ? { require_mfa_staff: true, email_approval_enabled: false } : { require_mfa_staff: false })}
            label="Vyžadovat dvoufázové ověření pro admina, HR a účetní"
          />
        </div>

        {company.require_mfa_staff === true && (
          <p className="mt-2 rounded border border-warning/40 bg-warning-light px-3 py-2 text-xs text-warning-dark">
            Při vyžadovaném dvoufázovém ověření je schvalování z e-mailu vypnuté: odkaz z e-mailu nevyžaduje přihlášení, takže by 2FA obcházel. Žádosti se schvalují v aplikaci (po přihlášení a ověření kódem).
          </p>
        )}
        <div className={cn("mt-4 flex items-center justify-between gap-4 rounded border border-line p-4", company.require_mfa_staff === true && "opacity-60")}>
          <div>
            <div className="text-sm font-medium">Schvalování přímo z e-mailu</div>
            <p className="mt-0.5 text-sm text-muted">
              E-mail o nové žádosti obsahuje tlačítka Schválit a Zamítnout. Vedou na potvrzovací stránku (rozhodnutí se nikdy neuloží samo kliknutím z náhledu e-mailu), odkaz platí 7 dní a jde použít jen pro čekající žádost. Vypněte, pokud chcete, aby se schvalovalo jen po přihlášení.
            </p>
          </div>
          <Switch
            checked={company.email_approval_enabled !== false && company.require_mfa_staff !== true}
            disabled={company.require_mfa_staff === true}
            onCheckedChange={(v) => patch({ email_approval_enabled: v })}
            label="Schvalování přímo z e-mailu"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded border border-line p-4">
          <div>
            <div className="text-sm font-medium">Absence jen v rámci vlastního oddělení</div>
            <p className="mt-0.5 text-sm text-muted">
              Zaměstnanci a manažeři uvidí v Týmovém kalendáři a widgetu „Kdo dnes chybí“ absence jen kolegů ze svého oddělení. Přímé podřízené a lidi ve svém oddělení vidí manažer vždy, i když formálně patří jinam. Admin, HR a účetní vidí vždy vše.
            </p>
          </div>
          <Switch checked={company.department_scoped_visibility === true} onCheckedChange={(v) => patch({ department_scoped_visibility: v })} label="Absence jen v rámci vlastního oddělení" />
        </div>
      </div>

      <DraftSaveBar dirty={dirty} status={saveStatus} error={saveError} onSave={save} onCancel={cancel} />

      <div className="card p-5">
        <h2 className="font-display text-h2">Kdo co vidí</h2>
        <p className="mt-1 text-sm text-muted">
          Jen pro přehled — nejde to tu upravit. Které typy absencí jsou citlivé (jen „Nepřítomen“ pro kolegy) nastavíte v Typech absencí.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1.5 pr-3 font-medium"></th>
                <th className="py-1.5 pr-3 text-center font-medium">Kolega</th>
                <th className="py-1.5 pr-3 text-center font-medium">Nadřízený / vedoucí</th>
                <th className="py-1.5 text-center font-medium">Admin / HR / Účetní</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-1.5 pr-3">Běžná absence (dovolená, home office…)</td>
                <td className="py-1.5 pr-3 text-center">Typ a termín</td>
                <td className="py-1.5 pr-3 text-center">Typ a termín</td>
                <td className="py-1.5 text-center">Typ a termín</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">Citlivá absence (nemoc, lékař…)</td>
                <td className="py-1.5 pr-3 text-center">Jen „Nepřítomen“</td>
                <td className="py-1.5 pr-3 text-center">Typ a termín</td>
                <td className="py-1.5 text-center">Typ a termín</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-3">Zůstatek dovolené</td>
                <td className="py-1.5 pr-3 text-center">—</td>
                <td className="py-1.5 pr-3 text-center">Svého týmu</td>
                <td className="py-1.5 text-center">Všech</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
