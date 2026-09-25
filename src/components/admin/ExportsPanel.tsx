"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { fetchDepartments } from "@/lib/data";
import { cn } from "@/lib/utils";
import { DbDepartment } from "@/lib/supabase/types";

const formats = [
  { key: "csv", label: "CSV pro Pohodu", icon: FileText, bookType: "csv" as const },
  { key: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet, bookType: "xlsx" as const },
  { key: "ods", label: "OpenDocument (ODS)", icon: FileType, bookType: "ods" as const },
] as const;

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

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toLocaleDateString("sv-SE");

    (async () => {
      const [{ data: employees }, { data: requests }, deps] = await Promise.all([
        supabase.from("profiles").select("id, name, department_id, department:departments!profiles_department_id_fkey(name)").eq("company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, working_days, leave_type:leave_types(key, counts_against)")
          .eq("status", "approved")
          .gte("start_date", monthStart)
          .lte("start_date", monthEnd),
        fetchDepartments(profile.company_id),
      ]);

      type Emp = { id: string; name: string; department_id: string | null; department: { name: string } | null };
      type Req = { profile_id: string; working_days: number; leave_type: { key: string; counts_against: string } | null };

      const built = ((employees as unknown as Emp[]) ?? []).map((e) => {
        const mine = ((requests as unknown as Req[]) ?? []).filter((r) => r.profile_id === e.id);
        return {
          id: e.id,
          name: e.name,
          departmentId: e.department_id,
          departmentName: e.department?.name ?? "Bez oddělení",
          vacationUsed: mine.filter((r) => r.leave_type?.counts_against === "vacation").reduce((s, r) => s + Number(r.working_days), 0),
          sickUsed: mine.filter((r) => r.leave_type?.counts_against === "sick").reduce((s, r) => s + Number(r.working_days), 0),
          homeOffice: mine.filter((r) => r.leave_type?.key === "home_office").reduce((s, r) => s + Number(r.working_days), 0),
        };
      });
      setRows(built);
      setDepartments(deps);
      setLoading(false);
    })();
  }, [profile, month]);

  const filteredRows = department === "all" ? rows : rows.filter((r) => r.departmentId === department);

  function handleExport() {
    const sheetRows = filteredRows.map((r) => ({
      Jméno: r.name,
      Oddělení: r.departmentName,
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
        <div className="border-b border-line p-5">
          <h2 className="font-display text-h2">Měsíční souhrn — náhled ({filteredRows.length})</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-muted">Načítám…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Jméno</th>
                <th className="px-5 py-3 font-medium">Oddělení</th>
                <th className="px-5 py-3 font-medium">Vyčerpaná dovolená</th>
                <th className="px-5 py-3 font-medium">Sick Days</th>
                <th className="px-5 py-3 font-medium">Home Office</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-5 py-3 text-muted">{e.departmentName}</td>
                  <td className="px-5 py-3">{e.vacationUsed}</td>
                  <td className="px-5 py-3">{e.sickUsed}</td>
                  <td className="px-5 py-3">{e.homeOffice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
