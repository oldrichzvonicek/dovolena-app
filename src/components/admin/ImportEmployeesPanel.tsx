"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, FileSpreadsheet, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchDepartments } from "@/lib/data";
import {
  AdminEmployeeRow,
  CompanyInviteRow,
  NewInvitePayload,
  deleteInvite,
  fetchCompany,
  fetchCompanyEmployees,
  fetchCompanyInvites,
  importEmployees,
} from "@/lib/admin-data";
import { IMPORT_CSV_TEMPLATE } from "@/lib/csv";
import {
  EmailPattern,
  FIELD_LABELS,
  FIELD_ORDER,
  FieldKey,
  ImportRow,
  Mapping,
  buildRows,
  detectHeaderRow,
  detectMapping,
  isImportable,
  parseTable,
} from "@/lib/employee-import";
import { readImportFile } from "@/lib/import-file";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DbDepartment } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";

type ManagerStatus = "none" | "existing" | "from-file" | "not-found";

const issueLabel: Record<string, string> = {
  "missing-name": "chybí jméno",
  "missing-email": "chybí e-mail",
  "invalid-email": "neplatný e-mail",
  "duplicate-email": "e-mail je v souboru víckrát",
  "already-exists": "už má účet",
  ended: "pracovní poměr skončil",
};

const fmtDate = (iso: string | null) => (iso ? `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}` : "—");
const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export function ImportEmployeesPanel() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [invites, setInvites] = useState<CompanyInviteRow[]>([]);
  const [defaults, setDefaults] = useState({ vacation: 20, sick: 5 });

  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [nameOrder, setNameOrder] = useState<"auto" | "first-last" | "last-first">("auto");
  const [skipEnded, setSkipEnded] = useState(true);
  const [guessDomain, setGuessDomain] = useState("");
  const [guessPattern, setGuessPattern] = useState<EmailPattern>("jmeno.prijmeni");
  const [emailOverrides, setEmailOverrides] = useState<Record<number, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!profile) return;
    const [deps, emps, inv, company] = await Promise.all([
      fetchDepartments(profile.company_id),
      fetchCompanyEmployees(profile.company_id),
      fetchCompanyInvites(profile.company_id),
      fetchCompany(profile.company_id),
    ]);
    setDepartments(deps);
    setEmployees(emps);
    setInvites(inv);
    setDefaults({ vacation: company.default_vacation_days, sick: company.default_sick_days });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function downloadTemplate() {
    const blob = new Blob(["﻿" + IMPORT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sablona-import-zamestnancu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function acceptTable(t: string[][], name: string | null) {
    setResult(null);
    setEmailOverrides({});
    setLoadError(null);
    const nonEmpty = t.filter((r) => r.some((c) => c.trim() !== ""));
    if (nonEmpty.length < 2) {
      setTable(null);
      setLoadError("V souboru jsem nenašel žádná data (potřebuji řádek s názvy sloupců a aspoň jednoho zaměstnance).");
      return;
    }
    const h = detectHeaderRow(nonEmpty);
    setTable(nonEmpty);
    setFileName(name);
    setHeaderRow(h);
    setMapping(detectMapping(nonEmpty[h]));
  }

  async function handleFile(file: File) {
    try {
      acceptTable(await readImportFile(file), file.name);
    } catch (e) {
      setTable(null);
      setLoadError(`Soubor se nepodařilo přečíst: ${errorMessage(e)}`);
    }
  }

  const headers = table?.[headerRow] ?? [];
  const nameMapped = mapping.name !== undefined || mapping.firstName !== undefined || mapping.lastName !== undefined;

  const existingEmails = useMemo(() => new Set(employees.map((e) => (e.email ?? "").toLowerCase()).filter(Boolean)), [employees]);

  const rows: ImportRow[] = useMemo(() => {
    if (!table || !nameMapped) return [];
    return buildRows(table, headerRow, mapping, {
      nameOrder,
      today: new Date().toLocaleDateString("sv-SE"),
      defaultVacation: defaults.vacation,
      defaultSick: defaults.sick,
      existingEmails,
      emailOverrides,
      guessDomain: guessDomain.trim() || undefined,
      guessPattern,
    });
  }, [table, headerRow, mapping, nameOrder, defaults, existingEmails, emailOverrides, guessDomain, guessPattern, nameMapped]);

  const importable = rows.filter((r) => isImportable(r, skipEnded));
  const skipped = rows.length - importable.length;
  const count = (issue: string) => rows.filter((r) => !isImportable(r, skipEnded) && r.issues.includes(issue as never)).length;
  const reasons = [
    count("missing-email") + count("invalid-email") > 0 ? `${count("missing-email") + count("invalid-email")}× e-mail` : "",
    count("already-exists") > 0 ? `${count("already-exists")}× už má účet` : "",
    count("duplicate-email") > 0 ? `${count("duplicate-email")}× duplicita` : "",
    count("ended") > 0 ? `${count("ended")}× pracovní poměr skončil` : "",
    count("missing-name") > 0 ? `${count("missing-name")}× bez jména` : "",
  ].filter(Boolean);
  const hasEmailColumn = mapping.email !== undefined;
  const anyMissingEmail = rows.some((r) => r.issues.includes("missing-email"));

  // Nadřízený: existující zaměstnanec, jiný řádek v souboru, nebo nenalezen.
  const existingNames = useMemo(() => new Map(employees.map((e) => [e.name.trim().toLowerCase(), e])), [employees]);
  const fileNames = useMemo(() => new Map(importable.map((r) => [r.name.trim().toLowerCase(), r.email])), [importable]);
  const managerStatus = (r: ImportRow): ManagerStatus => {
    if (!r.manager) return "none";
    const key = r.manager.trim().toLowerCase();
    if (existingNames.has(key)) return "existing";
    if (fileNames.has(key) && key !== r.name.trim().toLowerCase()) return "from-file";
    return "not-found";
  };

  async function handleConfirmImport() {
    if (!profile || importable.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const payload: NewInvitePayload[] = importable.map((r) => {
        const key = r.manager.trim().toLowerCase();
        const existing = r.manager ? existingNames.get(key) : undefined;
        const fromFile = r.manager && !existing && key !== r.name.trim().toLowerCase() ? fileNames.get(key) : undefined;
        return {
          email: r.email,
          name: r.name,
          department_name: r.department.trim() || null,
          manager_id: existing?.id ?? null,
          manager_invite_email: fromFile ?? null,
          vacation_total: r.vacationTotal,
          vacation_opening_used: r.vacationUsed,
          sick_total: r.sickTotal,
          sick_opening_used: r.sickUsed,
          hire_date: r.hireDate,
        };
      });
      await importEmployees(profile.company_id, payload);
      setResult({
        ok: true,
        text: `Úspěšně naimportováno ${payload.length} ${payload.length === 1 ? "pozvánka" : payload.length < 5 ? "pozvánky" : "pozvánek"}. Pošlete lidem odkaz na registraci — po přihlášení pod stejným e-mailem se jim data z importu doplní automaticky.`,
      });
      setTable(null);
      setFileName(null);
      setPasted("");
      setEmailOverrides({});
      load();
    } catch (e) {
      setResult({ ok: false, text: `Import selhal: ${errorMessage(e)}` });
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteInvite(id: string) {
    await deleteInvite(id);
    load();
  }

  function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  const sampleOf = (col: number | undefined) => (col === undefined || !table ? "" : (table[headerRow + 1]?.[col] ?? ""));

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-light text-moss-dark">
            <FileSpreadsheet size={15} />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-h2">
              Import zaměstnanců z mzdového nebo účetního systému
              <InfoTip
                label="Jak import funguje"
                text="Nahrajte export seznamu zaměstnanců z Excelu (.xlsx, .xls) nebo z CSV. Dodio samo pozná sloupce jako Příjmení, Jméno, Středisko, Datum nástupu, E-mail nebo Zbývající dovolená, poradí si s češtinou (Windows-1250) i s oddělovačem středník. Co nepozná, namapujete ručně. Před importem uvidíte náhled a nic se nezapíše, dokud nepotvrdíte."
              />
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nahrajte export z Excelu nebo CSV — sloupce se rozpoznají automaticky, před importem uvidíte náhled. Zaměstnanci dostanou pozvánku vázanou na jejich e-mail.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Nahrát soubor (Excel, CSV)
          </Button>
          <button onClick={downloadTemplate} className="flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper">
            <Download size={15} /> Stáhnout šablonu CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          {fileName && <span className="text-sm text-muted">Načteno: {fileName}</span>}
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-teal-dark">Nebo vložit tabulku ručně (zkopírovanou z Excelu)</summary>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            aria-label="Vložená tabulka"
            placeholder="Vložte řádky včetně názvů sloupců…"
            className="mt-2 w-full rounded border border-line px-3 py-2 font-mono text-xs"
          />
          <Button variant="secondary" className="mt-2" disabled={!pasted.trim()} onClick={() => acceptTable(parseTable(pasted), "vložená tabulka")}>
            Načíst vložená data
          </Button>
        </details>

        {loadError && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
            <AlertTriangle size={14} /> {loadError}
          </p>
        )}
      </div>

      {table && (
        <div className="card p-5">
          <h2 className="font-display text-h2">Rozpoznané sloupce</h2>
          <p className="mt-1 text-sm text-muted">Zkontrolujte, co se z kterého sloupce použije. Neznámé sloupce se přeskočí.</p>
          <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {FIELD_ORDER.map((f: FieldKey) => (
              <div key={f}>
                <label className="mb-1 block text-xs font-medium text-muted">{FIELD_LABELS[f]}</label>
                <Select
                  value={mapping[f] === undefined ? "none" : String(mapping[f])}
                  onValueChange={(v) =>
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === "none") delete next[f];
                      else next[f] = Number(v);
                      return next;
                    })
                  }
                >
                  <SelectTrigger className="py-1.5 text-sm" aria-label={FIELD_LABELS[f]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— nepoužít —</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h.trim() || `Sloupec ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mapping[f] !== undefined && sampleOf(mapping[f]) && <div className="mt-0.5 truncate text-[11px] text-muted">např. {sampleOf(mapping[f])}</div>}
              </div>
            ))}
          </div>

          {!nameMapped && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle size={14} /> Vyberte aspoň sloupec se jménem (buď „Jméno a příjmení“, nebo „Jméno“ a „Příjmení“).
            </p>
          )}

          {nameMapped && (
            <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line pt-4 text-sm">
              {mapping.name !== undefined && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Pořadí ve sloupci se jménem</label>
                  <Select value={nameOrder} onValueChange={(v) => setNameOrder(v as typeof nameOrder)}>
                    <SelectTrigger className="w-56 py-1.5 text-sm" aria-label="Pořadí jména">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automaticky podle názvu sloupce</SelectItem>
                      <SelectItem value="first-last">Jméno Příjmení</SelectItem>
                      <SelectItem value="last-first">Příjmení Jméno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mapping.endDate !== undefined && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={skipEnded} onChange={(e) => setSkipEnded(e.target.checked)} />
                  Přeskočit lidi, kterým už pracovní poměr skončil
                </label>
              )}
            </div>
          )}

          {nameMapped && (!hasEmailColumn || anyMissingEmail) && (
            <div className="mt-4 rounded border border-warning/40 bg-warning-light p-3 text-sm">
              <div className="font-medium text-warning-dark">{hasEmailColumn ? "Někomu chybí e-mail" : "Soubor neobsahuje e-maily"}</div>
              <p className="mt-0.5 text-xs text-muted">
                Pozvánka je vázaná na e-mail, takže ho potřebuje každý. Můžete ho doplnit v náhledu ručně, nebo navrhnout podle jména a firemní domény (vždy zkontrolujte).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs">Doména:</span>
                <input
                  value={guessDomain}
                  onChange={(e) => setGuessDomain(e.target.value)}
                  placeholder="firma.cz"
                  aria-label="Doména pro odhad e-mailů"
                  className="w-40 rounded border border-line px-2 py-1 text-sm"
                />
                <Select value={guessPattern} onValueChange={(v) => setGuessPattern(v as EmailPattern)}>
                  <SelectTrigger className="w-52 py-1 text-sm" aria-label="Vzor e-mailu">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jmeno.prijmeni">jmeno.prijmeni@doména</SelectItem>
                    <SelectItem value="prijmeni">prijmeni@doména</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {table && nameMapped && rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="font-display text-h2">Náhled importu</h2>
            <p className="mt-1 text-sm text-muted">
              <CheckCircle2 size={14} className="mr-1 inline text-teal-dark" />
              K importu {importable.length} z {rows.length} řádků
              {skipped > 0 && <span className="text-warning-dark"> · přeskočeno {skipped}{reasons.length > 0 ? ` (${reasons.join(", ")})` : ""}</span>}
            </p>
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <th className="bg-paper px-5 py-3 font-medium">Zaměstnanec</th>
                  <th className="bg-paper px-3 py-3 font-medium">E-mail</th>
                  <th className="bg-paper px-3 py-3 font-medium">Oddělení</th>
                  <th className="bg-paper px-3 py-3 font-medium">Nadřízený</th>
                  <th className="bg-paper px-3 py-3 font-medium">Nástup</th>
                  <th className="bg-paper px-3 py-3 text-right font-medium">Dovolená</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ok = isImportable(r, skipEnded);
                  const dept = departments.find((d) => d.name.trim().toLowerCase() === r.department.trim().toLowerCase());
                  const ms = managerStatus(r);
                  const editableEmail = r.issues.includes("missing-email") || r.issues.includes("invalid-email") || emailOverrides[r.index] !== undefined;
                  const flags = r.issues;
                  return (
                    <tr key={r.index} className={cn("border-b border-line last:border-0", !ok && "bg-paper/60 text-muted")}>
                      <td className="px-5 py-3">
                        <div className="font-medium">{r.name || "—"}</div>
                        {flags.length > 0 && <div className="text-[11px] text-warning-dark">{flags.map((i) => issueLabel[i]).join(" · ")}</div>}
                      </td>
                      <td className="px-3 py-3">
                        {editableEmail ? (
                          <input
                            value={emailOverrides[r.index] ?? r.email}
                            onChange={(e) => setEmailOverrides((o) => ({ ...o, [r.index]: e.target.value }))}
                            placeholder="doplňte e-mail"
                            aria-label={`E-mail pro ${r.name}`}
                            className={cn("w-48 rounded border px-2 py-1 text-xs", r.issues.includes("missing-email") || r.issues.includes("invalid-email") ? "border-danger" : "border-line")}
                          />
                        ) : (
                          <span className="text-xs">{r.email}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.department ? (
                          <span className="inline-flex items-center gap-1.5">
                            {r.department}
                            {!dept && <span className="rounded-sm bg-teal-light px-1.5 py-0.5 text-[11px] font-medium text-teal-dark">nové</span>}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {ms === "none" ? (
                          "—"
                        ) : ms === "not-found" ? (
                          <span className="inline-flex items-center gap-1.5 text-warning-dark">
                            <AlertTriangle size={13} /> {r.manager} — nenalezen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {r.manager}
                            {ms === "from-file" && <span className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] font-medium text-muted">ze souboru</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">{fmtDate(r.hireDate)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-xs">
                        zbývá {num(r.vacationTotal - r.vacationUsed)} z {num(r.vacationTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-5">
            <p className="max-w-xl text-xs text-muted">
              Chybějící oddělení se založí automaticky. Nenalezené nadřízené doplníte po importu v záložce Uživatelé. Import nic neposílá — zaměstnance pozvete odkazem na registraci.
            </p>
            <Button variant="primary" className="shrink-0" onClick={handleConfirmImport} disabled={importing || importable.length === 0}>
              {importing ? "Importuji…" : `Potvrdit import (${importable.length})`}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn("card flex items-start gap-2.5 p-5 text-sm", result.ok ? "border-teal/30 bg-teal-light text-teal-dark" : "border-danger/30 bg-danger-light text-danger")}>
          {result.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>{result.text}</span>
        </div>
      )}

      {invites.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-light text-warning-dark">
                <Clock size={15} />
              </div>
              <h2 className="font-display text-h2">Čekající pozvánky ({invites.length})</h2>
            </div>
            <p className="mt-2 text-sm text-muted">Zatím se nezaregistrovali. Jakmile se přihlásí pod uvedeným e-mailem, data z importu se jim automaticky přiřadí.</p>
          </div>
          <div className="divide-y divide-line">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4 hover:bg-paper">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal-dark">{initialsOf(inv.name)}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{inv.name}</div>
                    <div className="truncate text-xs text-muted">{inv.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteInvite(inv.id)}
                  className="shrink-0 rounded p-2 text-muted hover:bg-danger-light hover:text-danger"
                  aria-label={`Zrušit pozvánku pro ${inv.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
