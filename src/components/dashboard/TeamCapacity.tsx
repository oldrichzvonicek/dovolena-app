"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { reducesPresence } from "@/lib/leave-kinds";
import { fetchMaskedAbsences } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function TeamCapacity() {
  const { profile } = useAuth();
  const [teamSize, setTeamSize] = useState(0);
  const [outToday, setOutToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toLocaleDateString("sv-SE");

    (async () => {
      let teamQuery = supabase.from("profiles").select("id", { count: "exact" }).eq("company_id", profile.company_id).eq("active", true);
      if (profile.department_id) teamQuery = teamQuery.eq("department_id", profile.department_id);
      const { data: teamProfiles, count } = await teamQuery;
      const teamIds = new Set((teamProfiles ?? []).map((p) => p.id));

      const { data: outRows } = await supabase
        .from("leave_requests")
        .select("profile_id, leave_type:leave_types(key)")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today);

      const hiddenToday = (await fetchMaskedAbsences(today, today)).filter((m) => m.status === "approved");
      const outCount = new Set([
        ...((outRows as unknown as { profile_id: string; leave_type: { key: string } | null }[]) ?? [])
          .filter((r) => teamIds.has(r.profile_id) && reducesPresence(r.leave_type?.key))
          .map((r) => r.profile_id),
        ...hiddenToday.filter((m) => teamIds.has(m.profile_id)).map((m) => m.profile_id),
      ]).size;

      setTeamSize(count ?? 0);
      setOutToday(outCount);
      setLoading(false);
    })();
  }, [profile]);

  if (loading || teamSize === 0) return null;

  const pct = Math.round((outToday / teamSize) * 100);
  const high = pct >= 30;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        high ? "bg-warning-light text-warning-dark" : "bg-teal-light text-teal-dark"
      )}
      title={high ? "Vysoký podíl týmu je dnes mimo — zvažte to při schvalování dalších žádostí." : "Kolik lidí z vašeho oddělení je dnes v práci"}
    >
      <Users size={13} /> V práci {teamSize - outToday} z {teamSize} · {pct} % chybí
    </span>
  );
}
