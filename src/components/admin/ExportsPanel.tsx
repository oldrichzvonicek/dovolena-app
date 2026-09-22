"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const formats = [
  { key: "csv", label: "CSV pro Pohodu", icon: FileText },
  { key: "xlsx", label: "Excel (XLSX)", icon: FileSpreadsheet },
  { key: "pdf", label: "PDF sestava", icon: FileType },
] as const;

interface Row {
  id: string;
  name: string;
  vacationUsed: number;
  sickUsed: number;
  homeOffice: number;
}

export function ExportsPanel() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [format, setFormat] = useState<(typeof formats)[number]["key"]>("csv");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const monthStart = `${month}-01`;
    const monthEnd = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);

    (async () => {
      const { data: employees } = await supabase.from("profiles").select("id, name").eq("company_id", profile.company_id);
      const { data: requests } = await supabase
        .from("leave_requests")
        .select("profile_id, working_days, leave_type:leave_types(key, counts_against)")
        .eq("status", "approved")
        .gte("start_date", monthStart)
        .lte("start_date", monthEnd);

      type Emp = { id: string; name: string };
      type Req = { profile_id: string; working_days: number; leave_type: { key: string; counts_against: string } | null };

      const built = ((employees as unknown as Emp[]) ?? []).map((e) => {
        const mine = ((requests as unknown as Req[]) ?? []).filter((r) => r.profile_id === e.id);
        return {
          id: e.id,
          name: e.name,
          vacationUsed: mine.filter((r) => r.leave_type?.counts_against === "vacation").reduce((s, r) => s + Number(r.working_days), 0),
          sickUsed: mine.filter((r) => r.leave_type?.counts_against === "sick").reduce((s, r) => s + Number(r.working_days), 0),
          homeOffice: mine.filter((r) => r.leave_type?.key === "home_office").reduce((s, r) => s + Number(r.working_days), 0),
        };
      });
      setRows(built);
      setLoading(false);
    })();
  }, [profile, month]);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Generátor mzdových podkladů</h2>
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
            <label className="mb-1.5 block text-sm font-medium">Formát</label>
            <div className="flex gap-2">
              {formats.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={cn(
                    "flex items-center gap-2 rounded border px-3 py-2 text-sm",
                    format === f.key ? "border-teal bg-teal-light text-teal" : "border-line text-ink hover:bg-paper"
                  )}
                >
                  <f.icon size={15} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Button variant="primary" disabled>
            <Download size={16} /> Stáhnout podklady pro účetní
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Generování souboru zatím není zapojené — čísla níže jsou už reálná data z databáze, export do
          souboru je další krok.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <h2 className="font-display text-lg">Měsíční souhrn — náhled</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-muted">Načítám…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Jméno</th>
                <th className="px-5 py-3 font-medium">Vyčerpaná dovolená</th>
                <th className="px-5 py-3 font-medium">Sick Days</th>
                <th className="px-5 py-3 font-medium">Home Office</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-medium">{e.name}</td>
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
