"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { autoFitSheet } from "@/lib/xlsx-utils";
import { createZip } from "@/lib/zip";
import { AlertTriangle, FileArchive, FileSpreadsheet, FileText, Lock, LockOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_WORK_DAYS } from "@/lib/working-days";
import { buildPamicaXml } from "@/lib/pamica-export";
import {
  DETAIL_HEADERS,
  PayrollPerson,
  PayrollRequest,
  SUMMARY_HEADERS,
  buildPayrollRows,
  detailToTable,
  summarizePayroll,
  summaryToTable,
  toCsv,
} from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { LoadingLines } from "@/components/ui/skeleton";
import { cn, errorMessage } from "@/lib/utils";

const czDate = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;
const monthEndOf = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** Detailní měsíční podklad pro mzdy (jedna absence = jeden řádek) + uzávěrka měsíce. */
export function PayrollDetailPanel() {
  const { profile } = useAuth();
  const now = new Date().toLocaleDateString("sv-SE");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // výchozí je uplynulý měsíc — ten se typicky zpracovává
    return d.toLocaleDateString("sv-SE").slice(0, 7);
  });
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<PayrollPerson[]>([]);
  const [requests, setRequests] = useState<PayrollRequest[]>([]);
  const [hours, setHours] = useState(8);
  const [workDays, setWorkDays] = useState<number[]>(DEFAULT_WORK_DAYS);
  const [closure, setClosure] = useState<{ closed_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [includeWorking, setIncludeWorking] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pamicaMsg, setPamicaMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const start = `${month}-01`;
      const end = monthEndOf(month);

      const withCode = await supabase
        .from("leave_requests")
        .select("profile_id, start_date, end_date, working_days, half_day, leave_type:leave_types(key, label, payroll_code, counts_against, counts_as_present)")
        .eq("status", "approved")
        .lte("start_date", end)
        .gte("end_date", start);
      // Sloupec payroll_code vzniká až po spuštění aktualizovaného schema.sql.
      const reqRes = withCode.error
        ? await supabase.from("leave_requests").select("profile_id, start_date, end_date, working_days, half_day, leave_type:leave_types(key, label, counts_against, counts_as_present)").eq("status", "approved").lte("start_date", end).gte("end_date", start)
        : withCode;

      const [{ data: emps }, hrRes, { data: comp }, closureRes] = await Promise.all([
        supabase.from("profiles").select("id, name, email, department:departments!profiles_department_id_fkey(name)").eq("company_id", profile.company_id),
        supabase.from("profile_hr").select("profile_id, personal_number"),
        supabase.from("companies").select("work_days, standard_daily_hours").eq("id", profile.company_id).single(),
        supabase.from("payroll_closures").select("closed_at").eq("company_id", profile.company_id).eq("month", start).maybeSingle(),
      ]);
      if (!alive) return;
      const numbers = new Map(((hrRes.data as { profile_id: string; personal_number?: string | null }[]) ?? []).map((h) => [h.profile_id, h.personal_number ?? ""]));
      setPeople(
        ((emps as unknown as { id: string; name: string; email: string | null; department: { name: string } | null }[]) ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          departmentName: e.department?.name ?? "Bez oddělení",
          personalNumber: numbers.get(e.id) ?? "",
        }))
      );
      setRequests(((reqRes.data as unknown as PayrollRequest[]) ?? []).map((r) => ({ ...r, leave_type: r.leave_type ? { ...r.leave_type, payroll_code: r.leave_type.payroll_code ?? null } : null })));
      setWorkDays((comp?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS);
      setHours(Number(comp?.standard_daily_hours ?? 8));
      setClosure(closureRes.error ? null : (closureRes.data as { closed_at: string } | null));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [profile, month, tick]);

  const rows = useMemo(() => buildPayrollRows(requests, people, month, { workDays, hoursPerDay: hours, includeWorking }), [requests, people, month, workDays, hours, includeWorking]);
  const summary = useMemo(() => summarizePayroll(rows), [rows]);
  const q = search.trim().toLocaleLowerCase("cs");
  const visibleRows = q ? rows.filter((r) => `${r.firstName} ${r.lastName}`.toLocaleLowerCase("cs").includes(q) || r.typeLabel.toLocaleLowerCase("cs").includes(q)) : rows;
  const missingCode = Array.from(new Set(rows.filter((r) => !r.code).map((r) => r.typeLabel)));
  const missingNumber = Array.from(new Set(rows.filter((r) => !r.personalNumber).map((r) => `${r.firstName} ${r.lastName}`.trim())));
  const monthEnded = monthEndOf(month) < now;
  // Uzávěrku nejde spustit s neúplnými údaji pro mzdový systém (chybějící kódy nebo osobní čísla).
  const incomplete = rows.length > 0 && (missingCode.length > 0 || missingNumber.length > 0);

  function csvText() {
    return toCsv(DETAIL_HEADERS, detailToTable(rows));
  }

  function buildWorkbook() {
    const book = XLSX.utils.book_new();
    const detailTable = detailToTable(rows);
    const summaryTable = summaryToTable(summary);
    XLSX.utils.book_append_sheet(book, autoFitSheet(XLSX.utils.aoa_to_sheet([DETAIL_HEADERS, ...detailTable]), DETAIL_HEADERS, detailTable), "Detail");
    XLSX.utils.book_append_sheet(book, autoFitSheet(XLSX.utils.aoa_to_sheet([SUMMARY_HEADERS, ...summaryTable]), SUMMARY_HEADERS, summaryTable), "Souhrn");
    return book;
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function download(kind: "csv" | "xlsx") {
    if (kind === "csv") {
      triggerDownload(new Blob([csvText()], { type: "text/csv;charset=utf-8" }), `mzdovy-podklad-${month}.csv`);
      return;
    }
    XLSX.writeFile(buildWorkbook(), `mzdovy-podklad-${month}.xlsx`);
  }

  // Mzdový balíček: CSV i Excel podklad za zvolený měsíc v jednom staženém souboru — dřív si člověk musel
  // oba formáty stahovat zvlášť, i když je v drtivé většině případů chtěl oba (CSV do mzdového systému,
  // Excel pro sebe/kontrolu).
  function downloadZip() {
    const xlsxBytes = XLSX.write(buildWorkbook(), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const zip = createZip([
      { name: `mzdovy-podklad-${month}.csv`, data: new TextEncoder().encode(csvText()) },
      { name: `mzdovy-podklad-${month}.xlsx`, data: new Uint8Array(xlsxBytes) },
    ]);
    triggerDownload(zip, `mzdovy-balicek-${month}.zip`);
  }

  // Strukturovaný XML export pro mzdový systém PAMICA (Stormware) — podle oficiálního schématu dochazka.xsd,
  // na rozdíl od univerzálního CSV/Excel podkladu jde importovat přímo bez ručního přepisování.
  function downloadPamica() {
    const { xml, skippedNoNumber, skippedNoCode } = buildPamicaXml(
      people,
      requests.map((r) => ({ ...r, half_day: r.half_day ?? false })),
      month,
      { workDays, hoursPerDay: hours }
    );
    triggerDownload(new Blob([xml], { type: "application/xml;charset=utf-8" }), `pamica-dochazka-${month}.xml`);
    const notes: string[] = [];
    if (skippedNoNumber.length > 0) notes.push(`bez osobního čísla vynecháni: ${skippedNoNumber.join(", ")}`);
    if (skippedNoCode > 0) notes.push(`${skippedNoCode} ${skippedNoCode === 1 ? "absence" : "absencí"} bez kódu pro mzdy nebylo zahrnuto`);
    setPamicaMsg(notes.length > 0 ? `XML staženo (${notes.join("; ")}).` : "XML staženo.");
  }

  async function toggleClosure() {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await createClient().rpc(closure ? "reopen_payroll_month" : "close_payroll_month", { p_month: `${month}-01` });
      if (error) throw error;
      setMessage({ ok: true, text: closure ? "Měsíc je znovu otevřený." : "Měsíc je uzavřený. Schválené absence, které ho zasahují, už nejdou přidat, změnit ani smazat." });
      setTick((t) => t + 1);
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="flex items-center gap-1.5 font-display text-h2">
          Detail pro mzdy
          <InfoTip
            label="Co je detailní mzdový podklad"
            text="Jeden řádek na každou schválenou absenci za měsíc: osobní číslo, jméno, od–do, pracovní dny, hodiny, typ a kód pro mzdy. Absence přes přelom měsíců se rozdělí. Soubor je ve formátu CSV (středník, desetinná čárka, diakritika) nebo Excel se dvěma listy (detail a souhrn). Po odeslání podkladů můžete měsíc uzavřít, aby se už nic nezměnilo."
          />
        </h2>
        <p className="mt-1 text-sm text-muted">Univerzální podklad (CSV/Excel) pro ruční zpracování, nebo hotové XML přímo pro import do PAMICA.</p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Měsíc</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Měsíc" className="w-48 rounded border border-line px-3 py-2 text-sm" />
          </div>
          <Button variant="primary" onClick={() => download("csv")} disabled={loading || rows.length === 0}>
            <FileText size={15} /> Stáhnout CSV
          </Button>
          <Button variant="secondary" onClick={() => download("xlsx")} disabled={loading || rows.length === 0}>
            <FileSpreadsheet size={15} /> Stáhnout Excel (detail + souhrn)
          </Button>
          <Button variant="secondary" onClick={downloadZip} disabled={loading || rows.length === 0} title="CSV i Excel za tento měsíc v jednom souboru">
            <FileArchive size={15} /> Stáhnout balíček (ZIP)
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setPamicaMsg(null);
              downloadPamica();
            }}
            disabled={loading || rows.length === 0}
          >
            <FileText size={15} /> Stáhnout XML pro PAMICA
          </Button>
          <InfoTip
            label="Co je XML pro PAMICA"
            text="Strukturovaný soubor podle oficiálního formátu mzdového a personalistického systému PAMICA (Stormware) — jde nahrát přímo, bez ručního přepisování. Osoby bez osobního čísla a absence bez kódu pro mzdy se do souboru nezahrnou (viz upozornění výše)."
          />
          {pamicaMsg && <span className="text-sm text-muted">{pamicaMsg}</span>}
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeWorking} onChange={(e) => setIncludeWorking(e.target.checked)} />
          Zahrnout i Home Office a další typy, kdy člověk pracuje
        </label>

        {(missingCode.length > 0 || missingNumber.length > 0) && (
          <div className="mt-3 space-y-2 rounded border border-warning/40 bg-warning-light p-3 text-xs text-warning-dark">
            <div className="flex flex-wrap gap-2">
              {missingCode.length > 0 && (
                <Link href="/admin/settings?sekce=leave-types" className="rounded border border-warning/60 bg-white px-3 py-1.5 text-xs font-medium text-warning-dark hover:bg-warning/10">
                  Nastavit mzdové kódy ({missingCode.length})
                </Link>
              )}
              {missingNumber.length > 0 && (
                <Link href="/admin/settings?sekce=users" className="rounded border border-warning/60 bg-white px-3 py-1.5 text-xs font-medium text-warning-dark hover:bg-warning/10">
                  Doplnit osobní čísla ({missingNumber.length})
                </Link>
              )}
            </div>
            {missingCode.length > 0 && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Kód pro mzdy není vyplněný u: {missingCode.join(", ")}. Podklad je použitelný i tak (každý řádek nese název typu). Kódy jsou v každém mzdovém systému jiné, proto je nepředvyplňujeme — doplňte je jen tehdy, když je váš systém vyžaduje, v{" "}
                  <Link href="/admin/settings?sekce=leave-types" className="underline">
                    Nastavení → Typy absencí
                  </Link>{" "}
                  (u admina).
                </span>
              </p>
            )}
            {missingNumber.length > 0 && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>Bez osobního čísla: {missingNumber.slice(0, 6).join(", ")}{missingNumber.length > 6 ? ` a dalších ${missingNumber.length - 6}` : ""}. Osobní číslo doplní HR u zaměstnance.</span>
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-h2">
              {closure ? <Lock size={16} className="text-teal-dark" /> : <LockOpen size={16} className="text-muted" />}
              Uzávěrka měsíce
            </h2>
            <p className="mt-1 text-sm text-muted">
              {closure
                ? `Měsíc je uzavřený od ${czDate(closure.closed_at.slice(0, 10))}. Schválené absence, které ho zasahují, nejde přidat, změnit ani smazat.`
                : monthEnded
                  ? "Až podklady odešlete do mezd, měsíc uzavřete — pozdější změny absencí se tak nedostanou do už zpracovaných mezd."
                  : "Uzavřít lze jen měsíc, který už skončil."}
            </p>
          </div>
          <Button
            variant={closure || incomplete ? "secondary" : "primary"}
            onClick={() => (!closure && incomplete ? setBlockedOpen(true) : toggleClosure())}
            disabled={busy || loading || (!closure && !monthEnded)}
            className={cn(!closure && incomplete && "border-warning/60 text-warning-dark")}
            aria-describedby={!closure && incomplete ? "closure-blocked" : undefined}
          >
            {!closure && incomplete && <AlertTriangle size={14} />}
            {busy ? "Ukládám…" : closure ? "Znovu otevřít měsíc" : "Uzavřít měsíc"}
          </Button>
        </div>
        {!closure && incomplete && (
          <p id="closure-blocked" className="mt-2 text-xs text-warning-dark">
            Uzávěrku nejde spustit, dokud nejsou vyplněné kódy pro mzdy a osobní čísla ({missingCode.length + missingNumber.length} chybějících údajů). Kliknutím uvidíte přehled.
          </p>
        )}
        {message && <p className={cn("mt-3 text-sm", message.ok ? "text-teal-dark" : "text-danger")}>{message.text}</p>}
      </div>

      <Dialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <DialogContent title="Uzávěrku nejde spustit">
          <p className="text-sm text-muted">Pro mzdový systém chybí údaje. Doplňte je a uzávěrku spusťte znovu.</p>
          {missingCode.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium">Chybí kód pro mzdy u typů absence ({missingCode.length})</div>
              <p className="mt-1 text-sm text-muted">{missingCode.join(", ")}</p>
              <Link href="/admin/settings?sekce=leave-types" className="mt-2 inline-block rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-dark">
                Nastavit mzdové kódy
              </Link>
            </div>
          )}
          {missingNumber.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium">Chybí osobní číslo ({missingNumber.length})</div>
              <p className="mt-1 text-sm text-muted">
                {missingNumber.slice(0, 12).join(", ")}
                {missingNumber.length > 12 ? ` a dalších ${missingNumber.length - 12}` : ""}
              </p>
              <Link href="/admin/settings?sekce=users" className="mt-2 inline-block rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-dark">
                Doplnit osobní čísla
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <h2 className="font-display text-h2">Náhled ({visibleRows.length} {visibleRows.length === 1 ? "řádek" : visibleRows.length < 5 ? "řádky" : "řádků"})</h2>
          {rows.length > 0 && (
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat jméno nebo typ…" aria-label="Hledat jméno nebo typ"
                className="w-56 rounded border border-line py-1.5 pl-3 pr-3 text-sm"
              />
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-5">
            <LoadingLines rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">V tomto měsíci nejsou žádné schválené absence.</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0">
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  {["Os. č.", "Příjmení", "Jméno", "Od", "Do", "Dnů", "Hodin", "Typ", "Kód"].map((h) => (
                    <th key={h} className="bg-paper px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 text-xs tabular-nums">{r.personalNumber || "—"}</td>
                    <td className="px-3 py-2 font-medium">{r.lastName}</td>
                    <td className="px-3 py-2">{r.firstName}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{czDate(r.from)}</td>
                    <td className="px-3 py-2 text-xs tabular-nums">{czDate(r.to)}</td>
                    <td className="px-3 py-2 tabular-nums">{String(r.days).replace(".", ",")}</td>
                    <td className="px-3 py-2 tabular-nums">{String(r.hours).replace(".", ",")}</td>
                    <td className="px-3 py-2">{r.typeLabel}</td>
                    <td className="px-3 py-2 text-xs">{r.code || <span className="text-warning-dark">chybí</span>}</td>
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted">
                      Nic neodpovídá hledání.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
