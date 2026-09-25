"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { AlertTriangle, FileSpreadsheet, FileText, Lock, LockOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_WORK_DAYS } from "@/lib/working-days";
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
  const missingCode = Array.from(new Set(rows.filter((r) => !r.code).map((r) => r.typeLabel)));
  const missingNumber = Array.from(new Set(rows.filter((r) => !r.personalNumber).map((r) => `${r.firstName} ${r.lastName}`.trim())));
  const monthEnded = monthEndOf(month) < now;

  function download(kind: "csv" | "xlsx") {
    if (kind === "csv") {
      const blob = new Blob([toCsv(DETAIL_HEADERS, detailToTable(rows))], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mzdovy-podklad-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([DETAIL_HEADERS, ...detailToTable(rows)]), "Detail");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([SUMMARY_HEADERS, ...summaryToTable(summary)]), "Souhrn");
    XLSX.writeFile(book, `mzdovy-podklad-${month}.xlsx`);
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
        <p className="mt-1 text-sm text-muted">Podklad je univerzální (CSV/Excel). Až budeme znát importní formát vašeho mzdového systému, doplníme jeho šablonu.</p>

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
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeWorking} onChange={(e) => setIncludeWorking(e.target.checked)} />
          Zahrnout i Home Office a další typy, kdy člověk pracuje
        </label>

        {(missingCode.length > 0 || missingNumber.length > 0) && (
          <div className="mt-3 space-y-1 rounded border border-warning/40 bg-warning-light p-3 text-xs text-warning-dark">
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
          <Button variant={closure ? "secondary" : "primary"} onClick={toggleClosure} disabled={busy || loading || (!closure && !monthEnded)}>
            {busy ? "Ukládám…" : closure ? "Znovu otevřít měsíc" : "Uzavřít měsíc"}
          </Button>
        </div>
        {message && <p className={cn("mt-3 text-sm", message.ok ? "text-teal-dark" : "text-danger")}>{message.text}</p>}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-h2">Náhled ({rows.length} {rows.length === 1 ? "řádek" : rows.length < 5 ? "řádky" : "řádků"})</h2>
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
                {rows.map((r, i) => (
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
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
