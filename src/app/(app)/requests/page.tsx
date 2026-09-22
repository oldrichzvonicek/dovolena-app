"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";
import { LeaveColor, RequestStatus } from "@/lib/supabase/types";

const statusLabel: Record<RequestStatus, string> = {
  pending: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
};

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  status: RequestStatus;
  leave_type: { key: string; label: string; color: LeaveColor };
}

export default function RequestsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, leave_type:leave_types(key, label, color)")
      .eq("profile_id", profile.id)
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        setRows((data as unknown as Row[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  return (
    <div>
      <Header title="Moje žádosti" subtitle="Historie tvých absencí a stav schválení" />
      <div className="p-8">
        {loading && <p className="text-sm text-muted">Načítám…</p>}
        {!loading && rows.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">Zatím jste nepodal žádnou žádost.</div>
        )}
        {rows.length > 0 && (
          <div className="card divide-y divide-line">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <LeaveBadge type={r.leave_type} />
                  <span className="text-sm">{formatRange(r.start_date, r.end_date)}</span>
                </div>
                <span className="text-sm text-muted">{statusLabel[r.status]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
