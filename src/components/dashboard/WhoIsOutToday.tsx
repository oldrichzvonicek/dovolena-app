"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  leave_type: { key: string; label: string; color: "teal" | "rust" | "moss" | "violet" | "amber" } | null;
  profile: { id: string; name: string; avatar_initials: string | null } | null;
  department: { name: string } | null;
}

export function WhoIsOutToday() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from("leave_requests")
      .select(
        `id, start_date, end_date,
         leave_type:leave_types(key, label, color),
         profile:profiles!leave_requests_profile_id_fkey(id, name, avatar_initials, department:departments(name))`
      )
      .eq("status", "approved")
      .lte("start_date", today)
      .gte("end_date", today)
      .then(({ data }) => {
        const mapped = ((data as unknown[]) ?? []).map((r) => {
          const row = r as {
            id: string;
            start_date: string;
            end_date: string;
            leave_type: Row["leave_type"];
            profile: { id: string; name: string; avatar_initials: string | null; department: { name: string } | null } | null;
          };
          return {
            id: row.id,
            start_date: row.start_date,
            end_date: row.end_date,
            leave_type: row.leave_type,
            profile: row.profile,
            department: row.profile?.department ?? null,
          };
        });
        setRows(mapped);
        setLoading(false);
      });
  }, []);

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">Kdo dnes / tento týden chybí?</h2>
      <div className="mt-4 space-y-3">
        {loading && <p className="text-sm text-muted">Načítám…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-muted">Dnes je celý tým přítomen.</p>}
        {rows.map((r) => {
          if (!r.profile || !r.leave_type) return null;
          return (
            <div key={r.id} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-paper text-xs font-medium">
                  {r.profile.avatar_initials}
                </div>
                <div>
                  <div className="text-sm font-medium">{r.profile.name}</div>
                  <div className="text-xs text-muted">{r.department?.name}</div>
                </div>
              </div>
              <div className="text-right">
                <LeaveBadge type={r.leave_type} />
                <div className="mt-1 text-xs text-muted">{formatRange(r.start_date, r.end_date)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
