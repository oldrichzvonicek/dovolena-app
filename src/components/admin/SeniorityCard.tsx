"use client";

import { useState } from "react";
import { Award, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { updateCompany } from "@/lib/admin-data";
import { emitDataChanged } from "@/lib/events";
import { formatNumber, errorMessage } from "@/lib/utils";

export interface SeniorityRule {
  years: number;
  extra_days: number;
}

interface PreviewRow {
  profile_id: string;
  name: string;
  hire_date: string;
  years: number;
  bonus: number;
  current_total: number;
  new_total: number;
}

/** Příplatek k dovolené za odpracované roky: stupně "od X let +Y dní" a hromadný přepočet nároků podle data nástupu. */
export function SeniorityCard({
  companyId,
  enabled: initialEnabled,
  rules: initialRules,
  defaultVacation,
}: {
  companyId: string;
  enabled: boolean;
  rules: SeniorityRule[];
  defaultVacation: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [rules, setRules] = useState<SeniorityRule[]>(initialRules);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function persist(nextEnabled: boolean, nextRules: SeniorityRule[]) {
    const clean = nextRules
      .filter((r) => Number.isFinite(r.years) && Number.isFinite(r.extra_days) && r.years > 0 && r.extra_days >= 0)
      .sort((a, b) => a.years - b.years);
    setStatus({ text: "Ukládám…", error: false });
    try {
      await updateCompany(companyId, { seniority_enabled: nextEnabled, seniority_rules: clean } as never);
      setStatus({ text: "Uloženo", error: false });
      setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setStatus({ text: errorMessage(e), error: true });
    }
  }

  function toggle(v: boolean) {
    setEnabled(v);
    persist(v, rules);
  }

  function changeRule(i: number, patch: Partial<SeniorityRule>) {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRule() {
    const last = rules[rules.length - 1];
    const next = [...rules, { years: last ? last.years + 5 : 5, extra_days: last ? last.extra_days + 5 : 5 }];
    setRules(next);
    persist(enabled, next);
  }

  function removeRule(i: number) {
    const next = rules.filter((_, idx) => idx !== i);
    setRules(next);
    persist(enabled, next);
  }

  async function openPreview(y: number) {
    setYear(y);
    setPreviewOpen(true);
    setLoadingPreview(true);
    setPreviewError(null);
    setRows(null);
    const { data, error } = await createClient().rpc("seniority_preview", { p_year: y });
    setLoadingPreview(false);
    if (error) {
      setPreviewError(errorMessage(error));
      return;
    }
    setRows(((data as PreviewRow[]) ?? []).map((r) => ({ ...r, bonus: Number(r.bonus), current_total: Number(r.current_total), new_total: Number(r.new_total) })));
  }

  async function apply() {
    setApplying(true);
    setPreviewError(null);
    const { error } = await createClient().rpc("apply_seniority_entitlements", { p_year: year });
    setApplying(false);
    if (error) {
      setPreviewError(errorMessage(error));
      return;
    }
    emitDataChanged();
    setPreviewOpen(false);
    setStatus({ text: "Nároky byly přepočítány.", error: false });
    setTimeout(() => setStatus(null), 3000);
  }

  const changed = (rows ?? []).filter((r) => r.new_total !== r.current_total);
  const thisYear = new Date().getFullYear();

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <Award size={15} />
        </div>
        <h2 className="font-display text-h2">Dovolená podle odpracovaných let</h2>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className={status.error ? "text-sm text-danger-dark" : "text-sm text-muted"}>{status.text}</span>}
          <Switch checked={enabled} onCheckedChange={toggle} label="Zapnout příplatek za odpracované roky" />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        K výchozímu nároku ({formatNumber(defaultVacation)} dní) se přičte příplatek podle počtu let od nástupu. Platí nejvyšší dosažený stupeň; roky se počítají k 31. 12. daného roku. Datum nástupu vyplníte u každého člověka v Uživatelé → Upravit.
      </p>

      {enabled && (
        <>
          <div className="mt-4 space-y-2">
            {rules.length === 0 && <p className="text-sm text-muted">Zatím žádný stupeň. Přidejte například „od 5 let +5 dní“.</p>}
            {rules.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span>Od</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={r.years}
                  onChange={(e) => changeRule(i, { years: Number(e.target.value) })}
                  onBlur={() => persist(enabled, rules)}
                  aria-label={`Stupeň ${i + 1}: počet let`}
                  className="w-20 rounded border border-line px-2 py-1.5 text-right"
                />
                <span>let</span>
                <span className="text-muted">→ +</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={r.extra_days}
                  onChange={(e) => changeRule(i, { extra_days: Number(e.target.value) })}
                  onBlur={() => persist(enabled, rules)}
                  aria-label={`Stupeň ${i + 1}: dní navíc`}
                  className="w-20 rounded border border-line px-2 py-1.5 text-right"
                />
                <span>dní navíc</span>
                <span className="text-xs text-muted">(celkem {formatNumber(defaultVacation + r.extra_days)} dní)</span>
                <button onClick={() => removeRule(i)} aria-label={`Odebrat stupeň ${i + 1}`} className="ml-auto rounded p-2 text-muted hover:bg-danger-light hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={addRule}>
              <Plus size={15} /> Přidat stupeň
            </Button>
            <Button variant="secondary" onClick={() => openPreview(thisYear)} disabled={rules.length === 0}>
              Přepočítat nároky podle data nástupu…
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Noví zaměstnanci s vyplněným datem nástupu dostanou příplatek automaticky. Stávajícím se nárok změní až po potvrzení přepočtu.</p>
        </>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title={`Přepočet nároků na rok ${year}`} className="max-w-2xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {[thisYear, thisYear + 1].map((y) => (
              <button
                key={y}
                onClick={() => openPreview(y)}
                aria-pressed={year === y}
                className={year === y ? "rounded-full border border-ink bg-ink px-3 py-1 text-xs font-medium text-white" : "rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:bg-paper"}
              >
                Rok {y}
              </button>
            ))}
          </div>
          {loadingPreview && <p className="text-sm text-muted">Počítám…</p>}
          {previewError && <p className="text-sm text-danger-dark">{previewError}</p>}
          {rows && rows.length === 0 && <p className="text-sm text-muted">Nikdo nemá vyplněné datum nástupu. Doplňte ho v Uživatelé → Upravit.</p>}
          {rows && rows.length > 0 && (
            <>
              <p className="mb-2 text-sm text-muted">
                Nový nárok = výchozí nárok + příplatek za roky. Změní se {changed.length} {changed.length === 1 ? "člověk" : "lidí"}; ruční úpravy u nich se přepíšou. Lidé bez data nástupu se nemění.
              </p>
              <div className="max-h-[50vh] overflow-y-auto rounded border border-line">
                <table className="table-cards w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">Jméno</th>
                      <th className="px-3 py-2 font-medium">Nástup</th>
                      <th className="px-3 py-2 font-medium">Let</th>
                      <th className="px-3 py-2 font-medium">Příplatek</th>
                      <th className="px-3 py-2 font-medium">Nárok teď → nově</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.profile_id} className="border-b border-line last:border-0">
                        <td className="cell-title px-3 py-2 font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-muted" data-label="Nástup">{new Date(r.hire_date).toLocaleDateString("cs-CZ")}</td>
                        <td className="px-3 py-2" data-label="Let">{r.years}</td>
                        <td className="px-3 py-2" data-label="Příplatek">+{formatNumber(r.bonus)}</td>
                        <td className="px-3 py-2" data-label="Nárok teď → nově">
                          {formatNumber(r.current_total)} → <strong className={r.new_total !== r.current_total ? "text-teal-dark" : ""}>{formatNumber(r.new_total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              Zavřít
            </Button>
            <Button onClick={apply} disabled={applying || changed.length === 0}>
              {applying ? "Ukládám…" : `Použít změny (${changed.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
