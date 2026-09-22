"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

function Bar({ used, total, color }: { used: number; total: number; color: "teal" | "rust" | "moss" }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const barColor = { teal: "bg-teal", rust: "bg-rust", moss: "bg-moss" }[color];
  return (
    <div className="mt-3 h-1.5 w-full rounded-full bg-paper">
      <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function BalanceCard({
  label,
  used,
  total,
  unit,
  color,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  color: "teal" | "rust" | "moss";
}) {
  const remaining = total - used;
  return (
    <div className="card flex-1 p-5">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-display text-3xl">{remaining % 1 === 0 ? remaining : remaining.toFixed(1)}</span>
        <span className="text-sm text-muted">
          z {total} {unit}
        </span>
      </div>
      <Bar used={used} total={total} color={color} />
    </div>
  );
}

export function BalanceCards() {
  const { profile } = useAuth();
  const [vacation, setVacation] = useState({ used: 0, total: 0 });
  const [sick, setSick] = useState({ used: 0, total: 0 });
  const [homeOfficeThisMonth, setHomeOfficeThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const year = new Date().getFullYear();
    const monthStart = new Date(year, new Date().getMonth(), 1).toISOString().slice(0, 10);

    (async () => {
      const { data: entitlements } = await supabase
        .from("leave_entitlements")
        .select("total_days, leave_type:leave_types(key, counts_against)")
        .eq("profile_id", profile.id)
        .eq("year", year);

      const { data: requests } = await supabase
        .from("leave_requests")
        .select("working_days, status, leave_type:leave_types(key, counts_against)")
        .eq("profile_id", profile.id)
        .eq("status", "approved");

      type EntitlementRow = { total_days: number; leave_type: { key: string; counts_against: string } | null };
      type RequestRow = { working_days: number; leave_type: { key: string; counts_against: string } | null };

      const vacationTotal = ((entitlements as unknown as EntitlementRow[]) ?? [])
        .filter((e) => e.leave_type?.counts_against === "vacation")
        .reduce((sum, e) => sum + Number(e.total_days), 0);
      const sickTotal = ((entitlements as unknown as EntitlementRow[]) ?? [])
        .filter((e) => e.leave_type?.counts_against === "sick")
        .reduce((sum, e) => sum + Number(e.total_days), 0);

      const vacationUsed = ((requests as unknown as RequestRow[]) ?? [])
        .filter((r) => r.leave_type?.counts_against === "vacation")
        .reduce((sum, r) => sum + Number(r.working_days), 0);
      const sickUsed = ((requests as unknown as RequestRow[]) ?? [])
        .filter((r) => r.leave_type?.counts_against === "sick")
        .reduce((sum, r) => sum + Number(r.working_days), 0);

      const { data: homeOfficeRequests } = await supabase
        .from("leave_requests")
        .select("working_days, start_date, leave_type:leave_types(key)")
        .eq("profile_id", profile.id)
        .eq("status", "approved")
        .gte("start_date", monthStart);
      const homeOffice = ((homeOfficeRequests as unknown as { working_days: number; leave_type: { key: string } | null }[]) ?? [])
        .filter((r) => r.leave_type?.key === "home_office")
        .reduce((sum, r) => sum + Number(r.working_days), 0);

      setVacation({ used: vacationUsed, total: vacationTotal });
      setSick({ used: sickUsed, total: sickTotal });
      setHomeOfficeThisMonth(homeOffice);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-[104px] flex-1 animate-pulse bg-paper" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      <BalanceCard label="Dovolená" used={vacation.used} total={vacation.total} unit="dní" color="teal" />
      <BalanceCard label="Sick Days" used={sick.used} total={sick.total} unit="dní" color="rust" />
      <div className="card flex-1 p-5">
        <div className="text-sm text-muted">Home Office tento měsíc</div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="font-display text-3xl">{homeOfficeThisMonth}</span>
          <span className="text-sm text-muted">dny</span>
        </div>
      </div>
    </div>
  );
}
