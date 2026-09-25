"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { AdminEmployeeRow, fetchCompanyEmployees } from "@/lib/admin-data";
import { loadBalances } from "@/lib/balances";
import { DEFAULT_WORK_DAYS } from "@/lib/working-days";
import { Settlement, settleVacation } from "@/lib/settlement";
import { splitName, toCsv } from "@/lib/payroll";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { LoadingLines } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Line {
  employee: AdminEmployeeRow;
  total: number;
  s: Settlement;
}

const czDate = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;
const num = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

const HEADERS = ["Osobní číslo", "Příjmení", "Jméno", "Datum nástupu", "Datum ukončení", "Roční nárok", "Měsíců", "Poměrný nárok", "Převod", "Nárok celkem", "Vyčerpáno", "Zbývá / přečerpáno", "Naplánováno po odchodu"];

/** Vyrovnání dovolené při ukončení pracovního poměru (jen orientační podklad pro mzdovou účetní). */
export function SettlementPanel() {
  const { profile } = useAuth();
  const [lines, setLines] = useState<Line[] | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      const [emps, balances, { data: ents }, { data: reqs }, { data: comp }] = await Promise.all([
        fetchCompanyEmployees(profile.company_id),
        loadBalances(profile.company_id),
        supabase.from("leave_entitlements").select("profile_id, total_days, opening_used_days, leave_type:leave_types!inner(key, company_id)").eq("year", year).eq("leave_type.company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, leave_type:leave_types!inner(counts_against)")
          .eq("status", "approved")
          .eq("leave_type.counts_against", "vacation")
          .lte("start_date", `${year}-12-31`)
          .gte("end_date", `${year}-01-01`),
        supabase.from("companies").select("work_days").eq("id", profile.company_id).single(),
      ]);
      if (!alive) return;
      const workDays = (comp?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const entMap = new Map<string, { total: number; opening: number }>();
      for (const e of (ents as unknown as { profile_id: string; total_days: number; opening_used_days: number; leave_type: { key: string } }[]) ?? []) {
        if (e.leave_type.key === "dovolena") entMap.set(e.profile_id, { total: Number(e.total_days), opening: Number(e.opening_used_days) });
      }
      const reqMap = new Map<string, { start_date: string; end_date: string; working_days: number }[]>();
      for (const r of (reqs as unknown as { profile_id: string; start_date: string; end_date: string; working_days: number }[]) ?? []) {
        reqMap.set(r.profile_id, [...(reqMap.get(r.profile_id) ?? []), r]);
      }
      setLines(
        emps
          .filter((e) => e.termination_date && e.termination_date.startsWith(String(year)))
          .sort((a, b) => (a.termination_date ?? "").localeCompare(b.termination_date ?? ""))
          .map((e) => {
            const ent = entMap.get(e.id) ?? { total: 0, opening: 0 };
            const s = settleVacation({
              total: ent.total,
              carryover: balances.get(e.id, "vacation").carryover,
              openingUsed: ent.opening,
              requests: reqMap.get(e.id) ?? [],
              termination: e.termination_date!,
              hire: e.hire_date ?? null,
              workDays,
            });
            return { employee: e, total: ent.total, s };
          })
      );
    })();
    return () => {
      alive = false;
    };
  }, [profile, year]);

  const table = useMemo(
    () =>
      (lines ?? []).map((l) => {
        const { firstName, lastName } = splitName(l.employee.name);
        return [
          l.employee.personal_number ?? "",
          lastName,
          firstName,
          l.employee.hire_date ? czDate(l.employee.hire_date) : "",
          czDate(l.employee.termination_date!),
          num(l.total),
          String(l.s.months),
          num(l.s.prorated),
          num(l.s.carryover),
          num(l.s.entitled),
          num(l.s.used),
          num(l.s.balance),
          num(l.s.plannedAfter),
        ];
      }),
    [lines]
  );

  function download(kind: "csv" | "xlsx") {
    if (kind === "csv") {
      const blob = new Blob([toCsv(HEADERS, table)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vyrovnani-dovolene-${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([HEADERS, ...table]), "Vyrovnání");
    XLSX.writeFile(book, `vyrovnani-dovolene-${year}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="flex items-center gap-1.5 font-display text-h2">
          Vyrovnání dovolené při ukončení
          <InfoTip
            label="Jak se vyrovnání počítá"
            text="U lidí, kterým je v HR údajích nastavené datum ukončení pracovního poměru v tomto roce, Dodio spočítá poměrný nárok k datu odchodu (roční nárok × počet měsíců / 12; měsíc nástupu i ukončení se počítá celý, zaokrouhluje se nahoru na půl dne), přičte převod z minulého roku a odečte vyčerpané dny. Kladný výsledek = nevyčerpaná dovolená (náhrada mzdy), záporný = přečerpáno. Částku Dodio nepočítá, protože nezná průměrný výdělek."
          />
        </h2>
        <div className="mt-2 flex items-start gap-1.5 rounded border border-warning/40 bg-warning-light p-3 text-xs text-warning-dark">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Výpočet je orientační podklad pro mzdovou účetní. Pravidla krácení a zaokrouhlení si nechte potvrdit u své účetní nebo personalistky — jsou pro vaši firmu závazná ona, ne tabulka.</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => download("csv")} disabled={!lines || lines.length === 0}>
            <FileText size={15} /> Stáhnout CSV
          </Button>
          <Button variant="secondary" onClick={() => download("xlsx")} disabled={!lines || lines.length === 0}>
            <FileSpreadsheet size={15} /> Stáhnout Excel
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-h2">Odchody v roce {year}</h2>
        </div>
        {lines === null ? (
          <div className="p-5">
            <LoadingLines rows={4} />
          </div>
        ) : lines.length === 0 ? (
          <p className="p-5 text-sm text-muted">
            Nikdo nemá nastavené datum ukončení pracovního poměru v roce {year}. Nastaví ho HR nebo admin v Uživatelé → Upravit → „Datum ukončení pracovního poměru“.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  {["Zaměstnanec", "Odchod", "Roční nárok", "Poměrný nárok", "Převod", "Vyčerpáno", "Zbývá / přečerpáno", "Po odchodu"].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.employee.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-3">
                      <div className="font-medium">{l.employee.name}</div>
                      {l.employee.personal_number && <div className="text-[11px] text-muted">os. č. {l.employee.personal_number}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">{czDate(l.employee.termination_date!)}</td>
                    <td className="px-3 py-3 tabular-nums">{num(l.total)}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {num(l.s.prorated)}
                      <span className="block text-[11px] text-muted">{l.s.months} měs.</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{num(l.s.carryover)}</td>
                    <td className="px-3 py-3 tabular-nums">{num(l.s.used)}</td>
                    <td className={cn("px-3 py-3 font-medium tabular-nums", l.s.balance < 0 ? "text-danger" : "text-teal-dark")}>
                      {l.s.balance > 0 ? "+" : ""}
                      {num(l.s.balance)}
                      <span className="block text-[11px] font-normal text-muted">{l.s.balance < 0 ? "přečerpáno" : l.s.balance > 0 ? "nevyčerpáno" : "vyrovnáno"}</span>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      {l.s.plannedAfter > 0 ? <span className="text-warning-dark">{num(l.s.plannedAfter)} dní naplánováno</span> : "—"}
                    </td>
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
