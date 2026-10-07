"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, FileText, FileType, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { fetchDepartments, fetchLeaveTypes } from "@/lib/data";
import { cn, formatNumber } from "@/lib/utils";
import { safeCell } from "@/lib/csv";
import { autoFitSheet } from "@/lib/xlsx-utils";
import { toCsv } from "@/lib/payroll";
import { DEFAULT_WORK_DAYS, daysWithin, dayWord } from "@/lib/working-days";
import { DbDepartment } from "@/lib/supabase/types";
import { LoadingLines } from "@/components/ui/skeleton";

const formats = [
  { key: "csv", label: "CSV", icon: FileText, bookType: "csv" as const },
  { key: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet, bookType: "xlsx" as const },
  { key: "ods", label: "OpenDocument (ODS)", icon: FileType, bookType: "ods" as const },
] as const;

type SortKey = "name" | "departmentName" | "total";

interface TypeCol {
  key: string;
  label: string;
}

interface Row {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string;
  byType: Record<string, number>;
  total: number;
}

export function ExportsPanel() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // výchozí minulý měsíc — ten se u mezd zpracovává (stejně jako Detail pro mzdy)
    return d.toLocaleDateString("sv-SE").slice(0, 7);
  });
  const [format, setFormat] = useState<(typeof formats)[number]["key"]>("csv");
  const [department, setDepartment] = useState("all");
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [typeCols, setTypeCols] = useState<TypeCol[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideZero, setHideZero] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const isCurrentMonth = month === new Date().toLocaleDateString("sv-SE").slice(0, 7);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toLocaleDateString("sv-SE");

    (async () => {
      const [{ data: employees }, { data: requests }, deps, { data: comp }, leaveTypes] = await Promise.all([
        supabase.from("profiles").select("id, name, department_id, department:departments!profiles_department_id_fkey(name)").eq("company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, leave_type:leave_types(key, label, counts_as_present)")
          .eq("status", "approved")
          // Every absence that overlaps the month (not just those starting in it) — its days are split between months.
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart),
        fetchDepartments(profile.company_id),
        supabase.from("companies").select("work_days").eq("id", profile.company_id).single(),
        fetchLeaveTypes(profile.company_id),
      ]);
      const workDays = (comp?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const within = (r: { start_date: string; end_date: string; working_days: number }) => daysWithin(r, monthStart, monthEnd, workDays);

      type Emp = { id: string; name: string; department_id: string | null; department: { name: string } | null };
      type Req = { profile_id: string; start_date: string; end_date: string; working_days: number; leave_type: { key: string; label: string; counts_as_present: boolean } | null };

      // Jen typy, kdy člověk fakticky nepracuje (stejné pravidlo jako Detail pro mzdy, viz payroll.ts) —
      // Home Office a podobné "counts_as_present" typy do mzdového podkladu nepatří. Sloupce se berou z
      // toho, co se v daném měsíci skutečně vyskytlo (ne ze všech typů, co firma kdy měla), ať tabulka
      // není plná nul — dřív tu byly napevno jen tři sloupce (Dovolená/Sick Days/Home Office), takže
      // "Lékař" nebo "Náhradní volno" v souhrnu úplně chyběly.
      const relevant = ((requests as unknown as Req[]) ?? []).filter((r) => r.leave_type && !r.leave_type.counts_as_present);
      const labelByKey = new Map<string, string>();
      for (const t of leaveTypes) if (!t.counts_as_present) labelByKey.set(t.key, t.label);
      for (const r of relevant) if (!labelByKey.has(r.leave_type!.key)) labelByKey.set(r.leave_type!.key, r.leave_type!.label);
      const usedKeys = new Set(relevant.map((r) => r.leave_type!.key));
      const orderedKeys = leaveTypes.filter((t) => usedKeys.has(t.key)).map((t) => t.key);
      for (const k of usedKeys) if (!orderedKeys.includes(k)) orderedKeys.push(k); // pojistka: typ smazaný z leave_types, ale použitý v historii
      setTypeCols(orderedKeys.map((key) => ({ key, label: labelByKey.get(key) ?? key })));

      const built: Row[] = ((employees as unknown as Emp[]) ?? []).map((e) => {
        const mine = relevant.filter((r) => r.profile_id === e.id);
        const byType: Record<string, number> = {};
        for (const k of orderedKeys) byType[k] = 0;
        for (const r of mine) byType[r.leave_type!.key] = (byType[r.leave_type!.key] ?? 0) + within(r);
        const total = Object.values(byType).reduce((s, n) => s + n, 0);
        return { id: e.id, name: e.name, departmentId: e.department_id, departmentName: e.department?.name ?? "Bez oddělení", byType, total };
      });
      setRows(built);
      setDepartments(deps);
      setLoading(false);
    })();
  }, [profile, month]);

  const q = search.trim().toLocaleLowerCase("cs");
  const filteredRows = rows
    .filter((r) => department === "all" || r.departmentId === department)
    .filter((r) => !hideZero || r.total > 0)
    .filter((r) => !q || r.name.toLocaleLowerCase("cs").includes(q) || r.departmentName.toLocaleLowerCase("cs").includes(q))
    .sort((a, b) => {
      const va = sort.key === "total" ? a.total : a[sort.key];
      const vb = sort.key === "total" ? b.total : b[sort.key];
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "cs");
      return c * sort.dir || a.name.localeCompare(b.name, "cs");
    });
  const zeroCount = rows.filter((r) => (department === "all" || r.departmentId === department) && r.total === 0).length;
  // Kontrolní součet — účetní podle něj pozná, že export odpovídá kalendáři, bez skládání dvou exportů dohromady.
  const grandTotal = filteredRows.reduce((s, r) => s + r.total, 0);
  const toggleSort = (key: SortKey) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "departmentName" ? 1 : -1 }));

  function handleExport() {
    const headers = ["Jméno", "Oddělení", ...typeCols.map((t) => t.label), "Celkem"];
    // CSV jde přes toCsv (středník, desetinná čárka, BOM) — stejná konvence jako Detail pro mzdy. SheetJS
    // by do "csv" bookType napsalo čárku jako oddělovač i jako desetinnou tečku "6.5", což se v českém
    // Excelu rozjede (čárka je tam desetinná). XLSX/ODS numerické buňky tenhle problém nemají, tam zůstává
    // nativní zápis beze změny.
    if (format === "csv") {
      const table = filteredRows.map((r) => [r.name, r.departmentName, ...typeCols.map((t) => formatNumber(r.byType[t.key] ?? 0)), formatNumber(r.total)]);
      const blob = new Blob([toCsv(headers, table)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `podklady-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const table = filteredRows.map((r) => [safeCell(r.name), safeCell(r.departmentName), ...typeCols.map((t) => r.byType[t.key] ?? 0), r.total]);
    const sheet = autoFitSheet(XLSX.utils.aoa_to_sheet([headers, ...table]), headers, table);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Podklady");
    const chosen = formats.find((f) => f.key === format)!;
    XLSX.writeFile(book, `podklady-${month}.${format}`, { bookType: chosen.bookType });
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-h2">Generátor mzdových podkladů</h2>
        {isCurrentMonth && <p className="mt-1 text-xs text-warning-dark">Vybraný měsíc ještě neskončil — podklad bude neúplný, dokud měsíc neuplyne.</p>}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Měsíc a rok</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48 rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Oddělení</label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechna oddělení</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Formát</label>
            <div className="flex gap-2">
              {formats.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    "flex items-center gap-2 rounded border px-3 py-2 text-sm",
                    format === f.key ? "border-teal bg-teal-light text-teal-dark" : "border-line text-ink hover:bg-paper"
                  )}
                >
                  <f.icon size={15} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="primary" onClick={handleExport} disabled={loading || filteredRows.length === 0}>
            <Download size={16} /> Stáhnout podklady pro účetní
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <h2 className="font-display text-h2">Měsíční souhrn — náhled ({filteredRows.length})</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat jméno nebo oddělení" aria-label="Hledat v souhrnu" className="w-56 rounded border border-line py-1.5 pl-8 pr-3 text-sm" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} className="h-4 w-4" />
              Skrýt nulové řádky{hideZero && zeroCount > 0 ? ` (${zeroCount})` : ""}
            </label>
          </div>
        </div>
        {!loading && (
          <p className="border-b border-line bg-paper px-5 py-2 text-xs text-muted">
            Celkem {formatNumber(grandTotal)} {dayWord(grandTotal)} absencí ve vybraných řádcích — mělo by sedět s kalendářem.
            {hideZero && zeroCount > 0 && ` Skryto ${zeroCount} lidí bez absence v tomto měsíci.`} Stažený soubor obsahuje jen zobrazené řádky.
          </p>
        )}
        {loading ? (
          <div className="p-5"><LoadingLines rows={5} /></div>
        ) : typeCols.length === 0 ? (
          <p className="p-5 text-sm text-muted">Za tento měsíc nejsou žádné absence ovlivňující mzdu.</p>
        ) : (
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                {(
                  [
                    ["name", "Jméno"],
                    ["departmentName", "Oddělení"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-5 py-3 font-medium" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 uppercase tracking-wide hover:text-ink">
                      {label}
                      {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  </th>
                ))}
                {typeCols.map((t) => (
                  <th key={t.key} className="px-5 py-3 font-medium">{t.label}</th>
                ))}
                <th className="px-5 py-3 font-medium" aria-sort={sort.key === "total" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort("total")} className="flex items-center gap-1 uppercase tracking-wide hover:text-ink">
                    Celkem
                    {sort.key === "total" && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="cell-title px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-5 py-3 text-muted" data-label="Oddělení">{e.departmentName}</td>
                  {typeCols.map((t) => (
                    <td key={t.key} className="px-5 py-3" data-label={t.label}>{formatNumber(e.byType[t.key] ?? 0)}</td>
                  ))}
                  <td className="px-5 py-3 font-medium" data-label="Celkem">{formatNumber(e.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
