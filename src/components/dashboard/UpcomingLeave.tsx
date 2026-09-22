"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";

interface NextLeave {
  start_date: string;
  end_date: string;
  note: string | null;
  leave_type: { key: string; label: string; color: "teal" | "rust" | "moss" | "violet" | "amber" };
}

export function UpcomingLeave() {
  const { profile } = useAuth();
  const [next, setNext] = useState<NextLeave | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from("leave_requests")
      .select("start_date, end_date, note, leave_type:leave_types(key, label, color)")
      .eq("profile_id", profile.id)
      .eq("status", "approved")
      .gte("end_date", today)
      .order("start_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setNext(data as unknown as NextLeave | null);
        setLoading(false);
      });
  }, [profile]);

  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">Moje nadcházející absence</h2>
      <div className="mt-4">
        {loading && <p className="text-sm text-muted">Načítám…</p>}
        {!loading && !next && <p className="text-sm text-muted">Žádná naplánovaná absence.</p>}
        {next && (
          <div className="rounded border border-line bg-paper p-4">
            <LeaveBadge type={next.leave_type} />
            <div className="mt-2 font-display text-lg">{formatRange(next.start_date, next.end_date)}</div>
            {next.note && <div className="mt-1 text-sm text-muted">{next.note}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
