"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";

interface UpcomingRow {
  id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  status: "approved" | "pending";
  leave_type: { key: string; label: string; color: "teal" | "rust" | "moss" | "violet" | "amber" };
}

const VISIBLE = 4;

export function UpcomingLeave() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<UpcomingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toLocaleDateString("sv-SE");

    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, note, status, leave_type:leave_types(key, label, color)")
      .eq("profile_id", profile.id)
      .in("status", ["approved", "pending"])
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .then(({ data }) => {
        setRows((data as unknown as UpcomingRow[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  const shown = showAll ? rows : rows.slice(0, VISIBLE);

  return (
    <div className="card p-5">
      <h2 className="font-display text-h2">Moje nadcházející absence</h2>
      <div className="mt-3">
        {loading && <p className="text-sm text-muted">Načítám…</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-muted">Žádná naplánovaná absence.</p>}
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <LeaveBadge type={r.leave_type} className="shrink-0" />
              <span className="text-sm font-medium">{formatRange(r.start_date, r.end_date)}</span>
              {r.status === "pending" && (
                <span className="rounded-sm bg-warning-light px-1.5 py-0.5 text-[11px] font-medium text-warning-dark">⏳ Čeká na schválení</span>
              )}
              {r.note && <span className="min-w-0 max-w-[16rem] truncate text-xs text-muted">{r.note}</span>}
            </li>
          ))}
        </ul>
        {rows.length > VISIBLE && (
          <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-medium text-teal-dark hover:underline">
            {showAll ? "Zobrazit méně" : `Zobrazit všech ${rows.length} →`}
          </button>
        )}
      </div>
    </div>
  );
}
