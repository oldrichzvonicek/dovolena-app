"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AdminEmployeeRow, BalanceImportRow, fetchCompany, fetchCompanyEmployees, importBalances } from "@/lib/admin-data";
import {
  BalanceRow,
  FIELD_LABELS,
  FieldKey,
  Mapping,
  MatchKind,
  buildBalanceRows,
  detectHeaderRow,
  detectMapping,
  matchPerson,
  parseTable,
  resolveBalance,
} from "@/lib/employee-import";
import { assertImportSize, readImportFile } from "@/lib/import-file";
import { DEFAULT_WORK_DAYS, daysWithin } from "@/lib/working-days";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, errorMessage } from "@/lib/utils";

const FIELDS: FieldKey[] = ["name", "firstName", "lastName", "email", "vacationTotal", "vacationRemaining", "vacationUsed", "carryover", "sickTotal", "sickRemaining"];

interface Current {
  vacTotal: number | null;
  vacUsed: number;
  sickTotal: number | null;
  sickUsed: number;
}

interface Planned {
  row: BalanceRow;
  kind: MatchKind;
  person: AdminEmployeeRow | null;
  duplicate: boolean;
  payload: BalanceImportRow | null;
  /** Vyčerpáno v Excelu / z toho už zapsáno v Dodiu. */
  excelUsed: number | null;
  appUsed: number;
  vacTotal: number | null;
  vacUsed: number | null;
  sickTotal: number | null;
}

const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Import zůstatků existujících zaměstnanců z tabulky (přechod z Excelu): nárok, čerpání, převod z minulého roku. */
export function ImportBalancesPanel() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [current, setCurrent] = useState<Record<string, Current>>({});
  const [appDays, setAppDays] = useState<Record<string, { vac: number; sick: number }>>({});
  const [defaults, setDefaults] = useState({ vacation: 20, sick: 5 });

  const [table, setTable] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [nameOrder, setNameOrder] = useState<"auto" | "first-last" | "last-first">("auto");
  const [subtractApp, setSubtractApp] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!profile) return;
    const supabase = createClient();
    const yr = new Date().getFullYear();
    const [emps, company, { data: ents }, { data: reqs }, { data: comp }] = await Promise.all([
      fetchCompanyEmployees(profile.company_id),
      fetchCompany(profile.company_id),
      supabase
        .from("leave_entitlements")
        .select("profile_id, year, total_days, opening_used_days, leave_type:leave_types!inner(key, company_id)")
        .eq("year", yr)
        .eq("leave_type.company_id", profile.company_id),
      supabase
        .from("leave_requests")
        .select("profile_id, start_date, end_date, working_days, leave_type:leave_types(key)")
        .eq("status", "approved")
        .lte("start_date", `${yr}-12-31`)
        .gte("end_date", `${yr}-01-01`),
      supabase.from("companies").select("work_days").eq("id", profile.company_id).single(),
    ]);
    setEmployees(emps.filter((e) => e.active !== false && !e.join_pending));
    setDefaults({ vacation: company.default_vacation_days, sick: company.default_sick_days });

    const cur: Record<string, Current> = {};
    for (const e of (ents as unknown as { profile_id: string; total_days: number; opening_used_days: number; leave_type: { key: string } }[]) ?? []) {
      const c = (cur[e.profile_id] ??= { vacTotal: null, vacUsed: 0, sickTotal: null, sickUsed: 0 });
      if (e.leave_type.key === "dovolena") {
        c.vacTotal = Number(e.total_days);
        c.vacUsed = Number(e.opening_used_days);
      } else if (e.leave_type.key === "sick") {
        c.sickTotal = Number(e.total_days);
        c.sickUsed = Number(e.opening_used_days);
      }
    }
    setCurrent(cur);

    const workDays = (comp?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
    const days: Record<string, { vac: number; sick: number }> = {};
    for (const r of (reqs as unknown as { profile_id: string; start_date: string; end_date: string; working_days: number; leave_type: { key: string } | null }[]) ?? []) {
      const d = daysWithin(r, `${yr}-01-01`, `${yr}-12-31`, workDays);
      const slot = (days[r.profile_id] ??= { vac: 0, sick: 0 });
      if (r.leave_type?.key === "dovolena") slot.vac += d;
      else if (r.leave_type?.key === "sick") slot.sick += d;
    }
    setAppDays(days);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function acceptTable(t: string[][], name: string | null) {
    setResult(null);
    setLoadError(null);
    try {
      assertImportSize(t.length);
    } catch (e) {
      setTable(null);
      setLoadError(errorMessage(e));
      return;
    }
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
  const nameMapped = mapping.name !== undefined || mapping.firstName !== undefined || mapping.lastName !== undefined || mapping.email !== undefined;
  const hasVacation = mapping.vacationTotal !== undefined || mapping.vacationRemaining !== undefined || mapping.vacationUsed !== undefined;
  const hasSick = mapping.sickTotal !== undefined || mapping.sickRemaining !== undefined;
  const hasCarry = mapping.carryover !== undefined;
  const usesUsed = mapping.vacationUsed !== undefined || mapping.vacationRemaining !== undefined;

  const planned: Planned[] = useMemo(() => {
    if (!table || !nameMapped) return [];
    const people = employees.map((e) => ({ id: e.id, name: e.name, email: e.email }));
    const seen = new Set<string>();
    return buildBalanceRows(table, headerRow, mapping, nameOrder).map((row) => {
      const m = matchPerson(row, people);
      const person = m.person ? employees.find((e) => e.id === m.person!.id) ?? null : null;
      const duplicate = !!person && seen.has(person.id);
      if (person) seen.add(person.id);
      const cur = person ? current[person.id] : undefined;
      const app = person ? appDays[person.id] ?? { vac: 0, sick: 0 } : { vac: 0, sick: 0 };

      let vacTotal: number | null = null;
      let vacUsed: number | null = null;
      let excelUsed: number | null = null;
      if (hasVacation && (row.vacationTotal !== null || row.vacationRemaining !== null || row.vacationUsed !== null)) {
        const r = resolveBalance(row.vacationTotal, row.vacationRemaining, row.vacationUsed, cur?.vacTotal ?? defaults.vacation);
        vacTotal = r.total;
        excelUsed = r.used;
        vacUsed = subtractApp ? Math.max(0, r.used - app.vac) : r.used;
      }
      let sickTotal: number | null = null;
      let sickUsed: number | null = null;
      if (hasSick && (row.sickTotal !== null || row.sickRemaining !== null)) {
        const r = resolveBalance(row.sickTotal, row.sickRemaining, null, cur?.sickTotal ?? defaults.sick);
        sickTotal = r.total;
        sickUsed = subtractApp ? Math.max(0, r.used - app.sick) : r.used;
      }
      const carry = hasCarry ? row.carryover : null;
      const hasData = vacTotal !== null || sickTotal !== null || carry !== null;
      const ok = !!person && !duplicate && m.kind !== "ambiguous" && hasData;
      return {
        row,
        kind: m.kind,
        person,
        duplicate,
        excelUsed,
        appUsed: app.vac,
        vacTotal,
        vacUsed,
        sickTotal,
        payload: ok
          ? {
              profile_id: person!.id,
              vacation_total: vacTotal,
              vacation_used: vacUsed,
              carryover: carry,
              sick_total: sickTotal,
              sick_used: sickUsed,
            }
          : null,
      };
    });
  }, [table, headerRow, mapping, nameOrder, nameMapped, employees, current, appDays, defaults, hasVacation, hasSick, hasCarry, subtractApp]);

  const importable = planned.filter((p) => p.payload);
  const notFound = planned.filter((p) => p.kind === "none").length;
  const ambiguous = planned.filter((p) => p.kind === "ambiguous").length;
  const duplicates = planned.filter((p) => p.duplicate).length;
  const withAppDays = importable.filter((p) => p.appUsed > 0).length;

  async function apply() {
    if (!profile || importable.length === 0) return;
    setApplying(true);
    setResult(null);
    try {
      const n = await importBalances(profile.company_id, importable.map((p) => p.payload!));
      setResult({ ok: true, text: `Zůstatky byly nastaveny u ${n} ${n === 1 ? "zaměstnance" : "zaměstnanců"}. Zkontrolujte je v Uživatelé → roční nároky.` });
      setTable(null);
      setFileName(null);
      setPasted("");
      load();
    } catch (e) {
      setResult({ ok: false, text: `Import selhal: ${errorMessage(e)}` });
    } finally {
      setApplying(false);
    }
  }

  const sampleOf = (col: number | undefined) => (col === undefined || !table ? "" : (table[headerRow + 1]?.[col] ?? ""));
  const badge = (p: Planned) =>
    p.duplicate ? (
      <span className="text-warning-dark">duplicita v souboru</span>
    ) : p.kind === "ambiguous" ? (
      <span className="text-warning-dark">víc lidí stejného jména</span>
    ) : p.kind === "none" ? (
      <span className="text-warning-dark">v Dodiu nenalezen</span>
    ) : !p.payload ? (
      <span className="text-muted">bez údajů</span>
    ) : (
      <span className="text-teal-dark">{p.kind === "email" ? "podle e-mailu" : "podle jména"}</span>
    );

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moss-light text-moss-dark">
            <FileSpreadsheet size={15} />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-h2">
              Import zůstatků dovolené z tabulky
              <InfoTip
                label="Jak import zůstatků funguje"
                text="Slouží k přechodu z Excelu: nahrajete tabulku s nárokem, čerpáním nebo zbývající dovolenou a případným převodem z minulého roku. Lidé se přiřadí k zaměstnancům v Dodiu podle e-mailu, jinak podle jména. Nároky pro letošní rok se přepíšou; převod se uloží jako zbytek loňského nároku a platí pro něj pravidla propadnutí z Nastavení. Nic se nezapíše, dokud nepotvrdíte."
              />
            </h2>
            <p className="mt-1 text-sm text-muted">Pro lidi, kteří už v Dodiu mají účet. Nové zaměstnance s dovolenou nahrajete v záložce „Noví zaměstnanci“.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Nahrát soubor (Excel, CSV)
          </Button>
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
            aria-label="Vložená tabulka se zůstatky"
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
          <p className="mt-1 text-sm text-muted">Stačí jméno nebo e-mail a aspoň jeden sloupec se zůstatkem.</p>
          <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
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
              <AlertTriangle size={14} /> Vyberte sloupec se jménem nebo s e-mailem, podle kterého se lidé přiřadí.
            </p>
          )}

          {nameMapped && (
            <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
              {mapping.name !== undefined && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Pořadí ve sloupci se jménem</label>
                  <Select value={nameOrder} onValueChange={(v) => setNameOrder(v as typeof nameOrder)}>
                    <SelectTrigger className="w-64 py-1.5 text-sm" aria-label="Pořadí jména">
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
              {usesUsed && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={subtractApp} onChange={(e) => setSubtractApp(e.target.checked)} />
                  <span>
                    Odečíst od vyčerpaných dní absence, které už jsou zadané v Dodiu
                    <span className="block text-xs text-muted">
                      Zapněte, pokud tabulka obsahuje i dny, které jste mezitím zadali v Dodiu (jinak by se počítaly dvakrát). Vypněte, pokud tabulka obsahuje jen čerpání před přechodem.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {table && nameMapped && planned.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="font-display text-h2">Náhled změn</h2>
            <p className="mt-1 text-sm text-muted">
              <CheckCircle2 size={14} className="mr-1 inline text-teal-dark" />
              Zůstatky se nastaví u {importable.length} z {planned.length} řádků
              {notFound + ambiguous + duplicates > 0 && (
                <span className="text-warning-dark">
                  {" "}
                  · přeskočeno: {[notFound > 0 ? `${notFound}× nenalezen` : "", ambiguous > 0 ? `${ambiguous}× nejednoznačné jméno` : "", duplicates > 0 ? `${duplicates}× duplicita` : ""].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
            {withAppDays > 0 && (
              <p className="mt-1 text-xs text-muted">
                U {withAppDays} {withAppDays === 1 ? "člověka" : "lidí"} už jsou v Dodiu zapsané schválené absence z letošního roku.
                {usesUsed && (subtractApp ? " Jejich dny jsou odečtené od čerpání z tabulky." : " Jejich dny se přičtou k čerpání z tabulky.")}
              </p>
            )}
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <th className="bg-paper px-5 py-3 font-medium">Zaměstnanec</th>
                  <th className="bg-paper px-3 py-3 font-medium">Dovolená nyní</th>
                  <th className="bg-paper px-3 py-3 font-medium">Dovolená nově</th>
                  <th className="bg-paper px-3 py-3 font-medium">Převod</th>
                  <th className="bg-paper px-3 py-3 font-medium">Sick days</th>
                </tr>
              </thead>
              <tbody>
                {planned.map((p) => {
                  const cur = p.person ? current[p.person.id] : undefined;
                  return (
                    <tr key={p.row.index} className={cn("border-b border-line last:border-0", !p.payload && "bg-paper/60 text-muted")}>
                      <td className="px-5 py-3">
                        <div className="font-medium">{p.person?.name ?? (p.row.name || p.row.email || "—")}</div>
                        <div className="text-[11px]">{badge(p)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">{cur?.vacTotal != null ? `${num(cur.vacTotal)} nárok, ${num(cur.vacUsed)} čerpáno` : "—"}</td>
                      <td className="px-3 py-3 text-xs tabular-nums">
                        {p.vacTotal !== null && p.vacUsed !== null ? (
                          <span className="text-ink">
                            {num(p.vacTotal)} nárok, {num(p.vacUsed)} čerpáno
                            <span className="block text-muted">zbývá {num(p.vacTotal - p.vacUsed - (subtractApp ? p.appUsed : 0))}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">{hasCarry && p.row.carryover !== null ? `${num(p.row.carryover)} dní` : "—"}</td>
                      <td className="px-3 py-3 text-xs tabular-nums">{p.sickTotal !== null ? `${num(p.sickTotal)} dní` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line p-5">
            <p className="max-w-xl text-xs text-muted">
              Letošní nárok a počáteční čerpání se přepíšou. {hasCarry && "Převod se uloží jako zbytek loňského nároku a přepíše případný loňský záznam. "}Změnu vidí Historie změn.
            </p>
            <Button variant="primary" className="shrink-0" onClick={apply} disabled={applying || importable.length === 0}>
              {applying ? "Ukládám…" : `Nastavit zůstatky (${importable.length})`}
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
    </div>
  );
}
