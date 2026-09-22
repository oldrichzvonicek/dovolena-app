"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";

interface Row {
  id: string;
  name: string;
  departmentName: string | null;
  vacationTotal: number;
  vacationUsed: number;
}

export default function TeamPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const year = new Date().getFullYear();

    (async () => {
      const { data: employees } = await supabase
        .from("profiles")
        .select("id, name, department:departments(name)")
        .eq("company_id", profile.company_id);

      const { data: entitlements } = await supabase
        .from("leave_entitlements")
        .select("profile_id, total_days, leave_type:leave_types(counts_against)")
        .eq("year", year);

      const { data: requests } = await supabase
        .from("leave_requests")
        .select("profile_id, working_days, status, leave_type:leave_types(counts_against)")
        .eq("status", "approved");

      type Emp = { id: string; name: string; department: { name: string } | null };
      type Entitlement = { profile_id: string; total_days: number; leave_type: { counts_against: string } | null };
      type Req = { profile_id: string; working_days: number; leave_type: { counts_against: string } | null };

      const built = ((employees as unknown as Emp[]) ?? []).map((e) => {
        const vacationTotal = ((entitlements as unknown as Entitlement[]) ?? [])
          .filter((x) => x.profile_id === e.id && x.leave_type?.counts_against === "vacation")
          .reduce((s, x) => s + Number(x.total_days), 0);
        const vacationUsed = ((requests as unknown as Req[]) ?? [])
          .filter((x) => x.profile_id === e.id && x.leave_type?.counts_against === "vacation")
          .reduce((s, x) => s + Number(x.working_days), 0);
        return {
          id: e.id,
          name: e.name,
          departmentName: e.department?.name ?? null,
          vacationTotal,
          vacationUsed,
        };
      });

      setRows(built);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div>
      <Header title="Můj tým" subtitle="Přehled členů týmu a jejich zůstatků" />
      <div className="p-8">
        {loading && <p className="text-sm text-muted">Načítám…</p>}
        {!loading && (
          <div className="card divide-y divide-line">
            {rows.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-5">
                <div>
                  <div className="text-sm font-medium">{e.name}</div>
                  <div className="text-xs text-muted">{e.departmentName}</div>
                </div>
                <div className="text-sm text-muted">
                  Dovolená: {e.vacationTotal - e.vacationUsed} / {e.vacationTotal} dní
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
