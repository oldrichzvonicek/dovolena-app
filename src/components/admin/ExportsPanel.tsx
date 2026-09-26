"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, FileText, FileType, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { fetchDepartments } from "@/lib/data";
import { cn } from "@/lib/utils";
import { safeCell } from "@/lib/csv";
import { DEFAULT_WORK_DAYS, daysWithin } from "@/lib/working-days";
import { DbDepartment } from "@/lib/supabase/types";
import { LoadingLines } from "@/components/ui/skeleton";

const formats = [
  { key: "csv", label: "CSV", icon: FileText, bookType: "csv" as const },
  { key: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet, bookType: "xlsx" as const },
  { key: "ods", label: "OpenDocument (ODS)", icon: FileType, bookType: "ods" as const },
] as const;

type SortKey = "name" | "departmentName" | "vacationUsed" | "sickUsed" | "homeOffice";

interface Row {
  id: string;
  name: string;
  departmentId: string | null;
  departmentName: string;
  vacationUsed: number;
  sickUsed: number;
  homeOffice: number;
}

export function ExportsPanel() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(new Date().toLocaleDateString("sv-SE").slice(0, 7));
  const [format, setFormat] = useState<(typeof formats)[number]["key"]>("csv");
  const [department, setDepartment] = useState("all");
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideZero, setHideZero] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toLocaleDateString("sv-SE");

    (async () => {
      const [{ data: employees }, { data: requests }, deps, { data: comp }] = await Promise.all([
        supabase.from("profiles").select("id, name, department_id, department:departments!profiles_department_id_fkey(name)").eq("company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, leave_type:leave_types(key, counts_against)")
          .eq("status", "approved")
          // Every absence that overlaps the month (not just those starting in it) — its days are split between months.
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart),
        fetchDepartments(profile.company_id),
        supabase.from("companies").select("work_days").eq("id", profile.company_id).single(),
      ]);
      const workDays = (comp?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const within = (r: { start_date: string; end_date: string; working_days: number }) => daysWithin(r, monthStart, monthEnd, workDays);

      type Emp = { id: string; name: string; department_id: string | null; department: { name: string } | null };
      type Req = { profile_id: string; start_date: string; end_date: string; working_days: number; leave_type: { key: string; counts_against: string } | null };

      const built = ((employees as unknown as Emp[]) ?? []).map((e) => {
        const mine = ((requests as unknown as Req[]) ?? []).filter((r) => r.profile_id === e.id);
        return {
          id: e.id,
          name: e.name,
          departmentId: e.department_id,
          departmentName: e.department?.name ?? "Bez oddělení",
          vacationUsed: mine.filter((r) => r.leave_type?.counts_against === "vacation").reduce((s, r) => s + within(r), 0),
          sickUsed: mine.filter((r) => r.leave_type?.counts_against === "sick").reduce((s, r) => s + within(r), 0),
          homeOffice: mine.filter((r) => r.leave_type?.key === "home_office").reduce((s, r) => s + within(r), 0),
        };
      });
      setRows(built);
      setDepartments(deps);
      setLoading(false);
    })();
  }, [profile, month]);

  const q = search.trim().toLocaleLowerCase("cs");
  const filteredRows = rows
    .filter((r) => department === "all" || r.departmentId === department)
    .filter((r) => !hideZero || r.vacationUsed + r.sickUsed + r.homeOffice > 0)
    .filter((r) => !q || r.name.toLocaleLowerCase("cs").includes(q) || r.departmentName.toLocaleLowerCase("cs").includes(q))
    .sort((a, b) => {
      const va = a[sort.key];
      const vb = b[sort.key];
      const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "cs");
      return c * sort.dir || a.name.localeCompare(b.name, "cs");
    });
  const zeroCount = rows.filter((r) => (department === "all" || r.departmentId === department) && r.vacationUsed + r.sickUsed + r.homeOffice === 0).length;
  const toggleSort = (key: SortKey) => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "departmentName" ? 1 : -1 }));

  function handleExport() {
    const sheetRows = filteredRows.map((r) => ({
      Jméno: safeCell(r.name),
      Oddělení: safeCell(r.departmentName),
      "Vyčerpaná dovolená": r.vacationUsed,
      "Sick Days": r.sickUsed,
      "Home Office": r.homeOffice,
    }));
    const sheet = XLSX.utils.json_to_sheet(sheetRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Podklady");
    const chosen = formats.find((f) => f.key === format)!;
    XLSX.writeFile(book, `podklady-${month}.${format}`, { bookType: chosen.bookType });
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-h2">Generátor mzdových podkladů</h2>
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
        {!loading && hideZero && zeroCount > 0 && <p className="border-b border-line bg-paper px-5 py-2 text-xs text-muted">Skryto {zeroCount} lidí bez absence v tomto měsíci. Stažený soubor obsahuje jen zobrazené řádky.</p>}
        {loading ? (
          <div className="p-5"><LoadingLines rows={5} /></div>
        ) : (
          <table className="table-cards w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                {(
                  [
                    ["name", "Jméno"],
                    ["departmentName", "Oddělení"],
                    ["vacationUsed", "Vyčerpaná dovolená"],
                    ["sickUsed", "Sick Days"],
                    ["homeOffice", "Home Office"],
                  ] as [SortKey, string][]
                ).map(([key, label]) => (
                  <th key={key} className="px-5 py-3 font-medium" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 uppercase tracking-wide hover:text-ink">
                      {label}
                      {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="cell-title px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-5 py-3 text-muted" data-label="Oddělení">{e.departmentName}</td>
                  <td className="px-5 py-3" data-label="Vyčerpaná dovolená">{e.vacationUsed}</td>
                  <td className="px-5 py-3" data-label="Sick Days">{e.sickUsed}</td>
                  <td className="px-5 py-3" data-label="Home Office">{e.homeOffice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
