"use client";

import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRange } from "@/lib/working-days";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingCard } from "@/components/ui/skeleton";

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

// Kategorie pro filtr — podle prefixu action (před tečkou).
const categoryLabel: Record<string, string> = {
  request: "Žádosti o absenci",
  profile: "Uživatelé",
};

const PAGE_SIZES = [20, 50, 100];

/** Admin-only change history (audit_log, written by DB triggers). */
export function AuditLogPanel() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      // Víc než dřívějších 100, ať má hledání a filtry z čeho vybírat — stránkuje se až na klientovi.
      const [{ data, error }, { data: people }] = await Promise.all([
        supabase.from("audit_log").select("id, actor_id, action, created_at, details").order("created_at", { ascending: false }).limit(500),
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

  // Kdo se v historii objevuje jako actor — jen ti se nabízí ve filtru, ne celý seznam zaměstnanců.
  const actors = useMemo(() => {
    const ids = new Set((entries ?? []).map((e) => e.actor_id).filter((x): x is string => !!x));
    return Array.from(ids)
      .map((id) => ({ id, name: names[id] ?? "Uživatel" }))
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [entries, names]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("cs");
    return (entries ?? []).filter((e) => {
      if (actorFilter !== "all" && e.actor_id !== actorFilter) return false;
      if (categoryFilter !== "all" && !e.action.startsWith(`${categoryFilter}.`)) return false;
      if (!q) return true;
      const who = e.actor_id ? names[e.actor_id] ?? "" : "Systém";
      const haystack = `${who} ${actionLabel[e.action] ?? e.action} ${describe(e)}`.toLocaleLowerCase("cs");
      return haystack.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, search, actorFilter, categoryFilter, names]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const shown = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  if (failed) return <div className="card p-6 text-sm text-muted">Historie změn není k dispozici — spusťte aktuální schema.sql.</div>;
  if (!entries) return <LoadingCard rows={6} />;

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-5">
        <h2 className="font-display text-h2">Historie změn</h2>
        <p className="mt-0.5 text-xs text-muted">Posledních {entries.length} událostí — kdo co schválil, zamítl, zrušil nebo upravil.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Hledat (jméno, termín, důvod…)"
              aria-label="Hledat v historii změn"
              className="w-full min-w-[14rem] rounded border border-line bg-white py-2 pl-8 pr-3 text-sm sm:w-64"
            />
          </div>
          <Select
            value={actorFilter}
            onValueChange={(v) => {
              setActorFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-44" aria-label="Filtr podle uživatele">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni uživatelé</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-40" aria-label="Filtr podle kategorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {Object.entries(categoryLabel).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.length === 0 && <p className="p-5 text-sm text-muted">{entries.length === 0 ? "Zatím nic." : "Ničemu neodpovídá zvolený filtr."}</p>}
      <ul className="divide-y divide-line">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-2 text-sm">
            <span className="w-32 shrink-0 text-xs text-muted">{format(new Date(e.created_at), "d. M. yyyy HH:mm")}</span>
            <span>
              <span className="font-medium">{e.actor_id ? names[e.actor_id] ?? "Uživatel" : "Systém"}</span> {actionLabel[e.action] ?? e.action}
            </span>
            <span className="text-xs text-muted">{describe(e)}</span>
          </li>
        ))}
      </ul>
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-muted">
          <label className="flex items-center gap-2">
            Řádků na stránku
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="rounded border border-line bg-white px-2 py-1"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <span>
            {currentPage * pageSize + 1}–{Math.min(filtered.length, (currentPage + 1) * pageSize)} z {filtered.length}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0} aria-label="Předchozí stránka" className="rounded border border-line bg-white p-1.5 hover:bg-paper disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">
                {currentPage + 1} / {pageCount}
              </span>
              <button onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1} aria-label="Další stránka" className="rounded border border-line bg-white p-1.5 hover:bg-paper disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
