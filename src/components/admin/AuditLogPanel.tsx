"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRange } from "@/lib/working-days";

interface Entry {
  id: string;
  actor_id: string | null;
  action: string;
  created_at: string;
  details: Record<string, unknown>;
}

const actionLabel: Record<string, string> = {
  "request.created": "podal(a) žádost",
  "request.approved": "schválil(a) žádost",
  "request.rejected": "zamítl(a) žádost",
  "request.pending": "vrátil(a) žádost do čekání",
  "request.deleted": "smazal(a) žádost",
  "request.cancellation_requested": "požádal(a) o zrušení absence",
  "request.cancellation_declined": "ponechal(a) absenci (zrušení zamítnuto)",
  "profile.updated": "upravil(a) profil",
};

/** Admin-only change history (audit_log, written by DB triggers). */
export function AuditLogPanel() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [{ data, error }, { data: people }] = await Promise.all([
        supabase.from("audit_log").select("id, actor_id, action, created_at, details").order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("id, name").eq("company_id", profile.company_id),
      ]);
      if (error) {
        setFailed(true);
        return;
      }
      setNames(Object.fromEntries((people ?? []).map((p) => [p.id as string, p.name as string])));
      setEntries((data as unknown as Entry[]) ?? []);
    })();
  }, [profile]);

  if (failed) return <div className="card p-6 text-sm text-muted">Historie změn není k dispozici — spusťte aktuální schema.sql.</div>;
  if (!entries) return <div className="card p-8 text-center text-sm text-muted">Načítám…</div>;

  const describe = (e: Entry) => {
    const d = e.details as Record<string, string | boolean | string[] | null>;
    const who = typeof d.employee === "string" ? names[d.employee] : undefined;
    const parts: string[] = [];
    if (who) parts.push(`zaměstnanec: ${who}`);
    if (typeof d.start === "string" && typeof d.end === "string") parts.push(formatRange(d.start, d.end));
    if (typeof d.reason === "string" && d.reason) parts.push(`důvod: ${d.reason}`);
    if (Array.isArray(d.role)) parts.push(`role: ${d.role[0]} → ${d.role[1]}`);
    if (Array.isArray(d.active)) parts.push(d.active[1] ? "aktivován" : "deaktivován");
    if (d.department) parts.push("změněno oddělení");
    if (d.manager) parts.push("změněn nadřízený");
    return parts.join(" · ");
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-5">
        <h2 className="font-display text-h2">Historie změn</h2>
        <p className="mt-0.5 text-xs text-muted">Posledních 100 událostí — kdo co schválil, zamítl, zrušil nebo upravil.</p>
      </div>
      {entries.length === 0 && <p className="p-5 text-sm text-muted">Zatím nic.</p>}
      <ul className="divide-y divide-line">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2 text-sm">
            <span className="w-32 shrink-0 text-xs text-muted">{format(new Date(e.created_at), "d. M. yyyy HH:mm")}</span>
            <span>
              <span className="font-medium">{e.actor_id ? names[e.actor_id] ?? "Uživatel" : "Systém"}</span> {actionLabel[e.action] ?? e.action}
            </span>
            <span className="text-xs text-muted">{describe(e)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
