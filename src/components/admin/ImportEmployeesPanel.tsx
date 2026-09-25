"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Pencil, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchDepartments } from "@/lib/data";
import {
  AdminEmployeeRow,
  CompanyInviteRow,
  NewInvitePayload,
  deleteInvite,
  fetchCompanyEmployees,
  fetchCompanyInvites,
  importEmployees,
} from "@/lib/admin-data";
import { IMPORT_CSV_TEMPLATE, ParsedImportRow, parseEmployeeImportCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { DbDepartment } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";

type ManagerStatus = "none" | "existing" | "from-csv" | "not-found";

interface PreviewRow extends ParsedImportRow {
  departmentName: string;
  departmentIsNew: boolean;
  managerName: string | null;
  managerStatus: ManagerStatus;
  emailValid: boolean;
}

export function ImportEmployeesPanel() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [invites, setInvites] = useState<CompanyInviteRow[]>([]);
  const [rawCsv, setRawCsv] = useState("");
  const [showInput, setShowInput] = useState(true);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!profile) return;
    const [deps, emps, inv] = await Promise.all([
      fetchDepartments(profile.company_id),
      fetchCompanyEmployees(profile.company_id),
      fetchCompanyInvites(profile.company_id),
    ]);
    setDepartments(deps);
    setEmployees(emps);
    setInvites(inv);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function downloadTemplate() {
    const blob = new Blob([IMPORT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sablona-import-zamestnancu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setRawCsv(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
  }

  function handlePreview() {
    setResult(null);
    const { rows, missingColumns } = parseEmployeeImportCsv(rawCsv);
    setMissingColumns(missingColumns);
    if (missingColumns.length > 0) {
      setPreview(null);
      return;
    }

    const existingNames = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e]));
    const csvNameToEmail = new Map(rows.filter((r) => r.name).map((r) => [r.name.trim().toLowerCase(), r.email]));

    const built: PreviewRow[] = rows.map((r) => {
      const dep = departments.find((d) => d.name.trim().toLowerCase() === r.department.trim().toLowerCase());

      let managerName: string | null = null;
      let managerStatus: ManagerStatus = "none";
      if (r.manager) {
        managerName = r.manager;
        const managerKey = r.manager.trim().toLowerCase();
        if (existingNames.has(managerKey)) {
          managerStatus = "existing";
        } else if (csvNameToEmail.has(managerKey) && managerKey !== r.name.trim().toLowerCase()) {
          managerStatus = "from-csv";
        } else {
          managerStatus = "not-found";
        }
      }

      return {
        ...r,
        departmentName: r.department || "—",
        departmentIsNew: !!r.department && !dep,
        managerName,
        managerStatus,
        emailValid: /\S+@\S+\.\S+/.test(r.email),
      };
    });

    setPreview(built);
    setShowInput(false);
  }

  async function handleConfirmImport() {
    if (!profile || !preview) return;
    setImporting(true);
    setResult(null);
    try {
      const existingNames = new Map(employees.map((e) => [e.name.trim().toLowerCase(), e]));
      const csvNameToEmail = new Map(
        preview.filter((r) => r.name).map((r) => [r.name.trim().toLowerCase(), r.email])
      );

      const payload: NewInvitePayload[] = preview
        .filter((r) => r.emailValid && r.name)
        .map((r) => {
          let managerId: string | null = null;
          let managerInviteEmail: string | null = null;
          if (r.managerName) {
            const managerKey = r.managerName.trim().toLowerCase();
            const existing = existingNames.get(managerKey);
            if (existing) {
              managerId = existing.id;
            } else if (managerKey !== r.name.trim().toLowerCase() && csvNameToEmail.has(managerKey)) {
              managerInviteEmail = csvNameToEmail.get(managerKey)!;
            }
          }

          return {
            email: r.email,
            name: r.name,
            department_name: r.department.trim() || null,
            manager_id: managerId,
            manager_invite_email: managerInviteEmail,
            vacation_total: r.vacationTotal,
            vacation_opening_used: Math.max(0, r.vacationTotal - r.vacationRemaining),
            sick_total: r.sickTotal,
            sick_opening_used: Math.max(0, r.sickTotal - r.sickRemaining),
          };
        });

      await importEmployees(profile.company_id, payload);
      setResult({
        ok: true,
        text: `Úspěšně naimportováno ${payload.length} pozvánek. Odešlete lidem odkaz z pole „Pozvat kolegy" výše — po registraci pod stejným e-mailem se jim data doplní automaticky.`,
      });
      setRawCsv("");
      setPreview(null);
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

  const warningCount = preview?.filter((r) => r.managerStatus === "not-found" || !r.emailValid).length ?? 0;

  function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-light text-moss-dark">
              <Upload size={15} />
            </div>
            <div>
              <h2 className="font-display text-h2">Hromadný import zaměstnanců</h2>
              <p className="mt-1 text-sm text-muted">
                CSV se sloupci Jméno, Oddělení, Nadřízený, E-mail, Dovolená zbývá/celkem, Sick days zbývá/celkem.
                Chybějící oddělení se založí automaticky; nadřízený může být i jiný řádek v tomtéž souboru.
              </p>
            </div>
          </div>
          {!showInput && (
            <button
              onClick={() => setShowInput(true)}
              className="flex shrink-0 items-center gap-1.5 rounded border border-line px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink"
            >
              <Pencil size={14} /> Upravit CSV
            </button>
          )}
        </div>

        {showInput && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper"
              >
                <Download size={15} /> Stáhnout šablonu CSV
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper"
              >
                <Upload size={15} /> Nahrát CSV soubor
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            <textarea
              value={rawCsv}
              onChange={(e) => {
                setRawCsv(e.target.value);
                setPreview(null);
              }}
              rows={6}
              placeholder="Nebo sem vložte obsah CSV…" aria-label="Nebo sem vložte obsah CSV"
              className="mt-3 w-full rounded border border-line px-3 py-2 font-mono text-xs"
            />

            {missingColumns.length > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                <AlertTriangle size={14} /> Chybí povinné sloupce: {missingColumns.join(", ")}
              </p>
            )}

            <div className="mt-3">
              <Button variant="secondary" onClick={handlePreview} disabled={!rawCsv.trim()}>
                Zobrazit náhled
              </Button>
            </div>
          </>
        )}

        {!showInput && preview && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
            <CheckCircle2 size={15} className="text-teal-dark" />
            Načteno {preview.length} řádků
            {warningCount > 0 && <span className="text-warning-dark">· {warningCount} k doplnění</span>}
          </p>
        )}
      </div>

      {preview && preview.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="font-display text-h2">Náhled importu</h2>
            <p className="mt-1 text-sm text-muted">Zkontrolujte přiřazení, pak potvrďte.</p>
          </div>
          <div className="max-h-[45vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <th className="bg-paper px-5 py-3 font-medium">Zaměstnanec</th>
                  <th className="bg-paper px-3 py-3 font-medium">Oddělení</th>
                  <th className="bg-paper px-3 py-3 font-medium">Nadřízený</th>
                  <th className="bg-paper px-3 py-3 text-right font-medium">Dovolená</th>
                  <th className="bg-paper px-3 py-3 text-right font-medium">Sick days</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className={cn("text-xs", r.emailValid ? "text-muted" : "text-danger")}>
                        {r.email || "chybí e-mail"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {r.departmentName === "—" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {r.departmentName}
                          {r.departmentIsNew && (
                            <span className="rounded-sm bg-teal-light px-1.5 py-0.5 text-[11px] font-medium text-teal-dark">
                              nové
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.managerStatus === "none" ? (
                        <span className="text-muted">—</span>
                      ) : r.managerStatus === "not-found" ? (
                        <span className="inline-flex items-center gap-1.5 text-warning-dark">
                          <AlertTriangle size={13} /> {r.managerName} — nenalezen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {r.managerName}
                          {r.managerStatus === "from-csv" && (
                            <span className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] font-medium text-muted">
                              z importu
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">
                      {r.vacationRemaining} z {r.vacationTotal} dní
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">
                      {r.sickRemaining} z {r.sickTotal} dní
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-line p-5">
            <p className="text-xs text-muted">
              Řádky bez e-mailu se přeskočí. Nenalezené nadřízené doplňte po importu ručně v záložce Uživatelé.
            </p>
            <Button variant="primary" className="shrink-0" onClick={handleConfirmImport} disabled={importing}>
              {importing ? "Importuji…" : "Potvrdit import"}
            </Button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={cn(
            "card flex items-start gap-2.5 p-5 text-sm",
            result.ok ? "border-teal/30 bg-teal-light text-teal-dark" : "border-danger/30 bg-danger-light text-danger"
          )}
        >
          {result.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          )}
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
            <p className="mt-2 text-sm text-muted">
              Zatím se nezaregistrovali. Jakmile se přihlásí pod uvedeným e-mailem, data z importu se jim automaticky
              přiřadí.
            </p>
          </div>
          <div className="divide-y divide-line">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4 hover:bg-paper">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal-dark">
                    {initialsOf(inv.name)}
                  </div>
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
