"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarPlus, ChevronLeft, ChevronRight, Copy, LayoutGrid, Pencil, RefreshCw, Search, Table2, Undo2, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { LeaveBadge, StatusBadge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dayWord, formatRange } from "@/lib/working-days";
import { cn, errorMessage, formatNumber } from "@/lib/utils";
import { downloadIcs } from "@/lib/ics";
import { KebabMenu, KebabItem } from "@/components/shared/KebabMenu";
import { CompactBalances } from "@/components/dashboard/CompactBalances";
import { emitDataChanged, useOnDataChanged } from "@/lib/events";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { cancelLeaveRequest, requestLeaveCancellation } from "@/lib/data";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { LeaveColor, RequestStatus } from "@/lib/supabase/types";
import { LoadingLines } from "@/components/ui/skeleton";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note: string | null;
  covering_profile_id: string | null;
  rejection_reason: string | null;
  status: RequestStatus;
  cancellation_requested_at?: string | null;
  leave_type: { id: string; key: string; label: string; color: LeaveColor };
  approver: { name: string } | null;
}

const PAGE_SIZES = [10, 20, 50];
type StatusTab = "all" | RequestStatus;

const btn =
  "flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark";

export default function RequestsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [resubmitRow, setResubmitRow] = useState<Row | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  // Výchozí je přehledná tabulka; karty zůstávají jako druhý pohled.
  const [view, setView] = useState<"cards" | "table">("table");
  // Na desktopu se vejde víc řádků; na telefonu zůstává kratší stránka.
  const [pageSize, setPageSize] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? 10 : 20));
  const [coverNames, setCoverNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const todayISO = new Date().toLocaleDateString("sv-SE");

  function load() {
    if (!profile) return;
    const supabase = createClient();
    const base = `id, start_date, end_date, half_day, working_days, note, covering_profile_id, rejection_reason, status,
         leave_type:leave_types(id, key, label, color),
         approver:profiles!leave_requests_approved_by_fkey(name)`;
    const query = (cols: string) =>
      supabase.from("leave_requests").select(cols).eq("profile_id", profile.id).order("start_date", { ascending: false });
    // cancellation_requested_at needs the latest schema.sql; fall back so the page still works without it.
    query(base + ", cancellation_requested_at").then(async ({ data, error }) => {
      const res = error ? await query(base) : { data };
      setRows((res.data as unknown as Row[]) ?? []);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);
  useOnDataChanged(load);

  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.covering_profile_id).filter((x): x is string => !!x)));
    if (ids.length === 0) return;
    createClient()
      .from("profiles")
      .select("id, name")
      .in("id", ids)
      .then(({ data }) => setCoverNames(Object.fromEntries((data ?? []).map((p) => [p.id as string, p.name as string]))));
  }, [rows]);

  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.start_date.slice(0, 4)))).sort().reverse(), [rows]);
  const types = useMemo(() => {
    const map = new Map(rows.map((r) => [r.leave_type.id, r.leave_type.label]));
    return Array.from(map.entries());
  }, [rows]);

  const q = search.trim().toLocaleLowerCase("cs");
  const baseFiltered = rows.filter(
    (r) =>
      (yearFilter === "all" || r.start_date.startsWith(yearFilter)) &&
      (typeFilter === "all" || r.leave_type.id === typeFilter) &&
      (!q || (r.note ?? "").toLocaleLowerCase("cs").includes(q) || r.leave_type.label.toLocaleLowerCase("cs").includes(q))
  );
  const count = (st: StatusTab) => (st === "all" ? baseFiltered.length : baseFiltered.filter((r) => r.status === st).length);
  const filteredRows = (statusTab === "all" ? baseFiltered : baseFiltered.filter((r) => r.status === statusTab)).slice().sort((a, b) => (sortDesc ? -1 : 1) * a.start_date.localeCompare(b.start_date));
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const shownRows = filteredRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  async function handleCancel(id: string) {
    if (!(await confirmDialog("Zrušit tuto žádost? Nejde vzít zpět — pro jiný termín podáte novou.", { confirmLabel: "Zrušit žádost", danger: true }))) return;
    setCancellingId(id);
    try {
      await cancelLeaveRequest(id);
      load();
    } finally {
      setCancellingId(null);
    }
  }

  async function handleRequestCancellation(r: Row) {
    if (!(await confirmDialog("Požádat manažera o zrušení této schválené absence?", { confirmLabel: "Požádat o zrušení" }))) return;
    setActionError(null);
    try {
      await requestLeaveCancellation(r.id);
      emitDataChanged();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }

  function renderActions(r: Row, compact = false) {
    const canCancelApproved = r.status === "approved" && r.end_date >= todayISO;
    const dangerBtn = "flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-danger/40 hover:bg-danger-light hover:text-danger disabled:opacity-50";
    const items: { key: string; node: React.ReactNode; menu: KebabItem }[] = [];

    if (r.status === "pending") {
      items.push({
        key: "edit",
        node: (
          <button onClick={() => setEditingRow(r)} className={btn}>
            <Pencil size={12} /> Upravit
          </button>
        ),
        menu: { label: "Upravit", icon: <Pencil size={13} />, onClick: () => setEditingRow(r) },
      });
      items.push({
        key: "cancel",
        node: (
          <button onClick={() => handleCancel(r.id)} disabled={cancellingId === r.id} className={dangerBtn}>
            <X size={12} /> {cancellingId === r.id ? "Ruším…" : "Zrušit"}
          </button>
        ),
        menu: { label: "Zrušit žádost", icon: <X size={13} />, onClick: () => handleCancel(r.id), danger: true },
      });
    }
    if (r.status === "rejected") {
      items.push({
        key: "resubmit",
        node: (
          <button onClick={() => setResubmitRow(r)} className={btn}>
            <RefreshCw size={12} /> Upravit a poslat znovu
          </button>
        ),
        menu: { label: "Upravit a poslat znovu", icon: <RefreshCw size={13} />, onClick: () => setResubmitRow(r) },
      });
    }
    if (r.status === "approved") {
      items.push({
        key: "ics",
        node: (
            <button
            onClick={() => downloadIcs(r.leave_type.label, r.start_date, r.end_date, r.id)}
            className={compact ? "rounded border border-line p-1.5 text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark" : btn}
            title="Do kalendáře: stáhnout .ics pro Google, Outlook nebo Apple kalendář"
            aria-label="Do kalendáře"
          >
            <CalendarPlus size={compact ? 14 : 12} /> {!compact && "Do kalendáře"}
          </button>
        ),
        menu: { label: "Do kalendáře", icon: <CalendarPlus size={13} />, onClick: () => downloadIcs(r.leave_type.label, r.start_date, r.end_date, r.id) },
      });
      items.push({
        key: "dup",
        node: (
          <button onClick={() => setResubmitRow(r)} className={btn}>
            <Copy size={12} /> Duplikovat
          </button>
        ),
        menu: { label: "Duplikovat", icon: <Copy size={13} />, onClick: () => setResubmitRow(r) },
      });
      if (canCancelApproved) {
        items.push({
          key: "cancelreq",
          node: r.cancellation_requested_at ? (
            <span className="rounded-sm bg-warning-light px-2 py-1 text-xs font-medium text-warning-dark">⏳ Žádost o zrušení odeslána</span>
          ) : (
            <button onClick={() => handleRequestCancellation(r)} className={dangerBtn}>
              <Undo2 size={12} /> Požádat o zrušení
            </button>
          ),
          menu: { label: "Požádat o zrušení", icon: <Undo2 size={13} />, onClick: () => handleRequestCancellation(r), danger: true },
        });
      }
    }

    if (!compact) return <div className="flex flex-wrap items-center gap-2">{items.map((i) => <span key={i.key}>{i.node}</span>)}</div>;

    // Compact (table): one visible primary action, the rest behind •••
    const pending = r.status === "approved" && r.cancellation_requested_at;
    const [primary, ...rest] = items;
    return (
      <div className="flex items-center gap-1.5">
        {pending ? items[items.length - 1].node : primary?.node}
        <KebabMenu items={(pending ? items.slice(0, -1) : rest).map((i) => i.menu)} />
      </div>
    );
  }

  return (
    <div>
      <Header title="Moje žádosti" subtitle="Historie vašich absencí a stav schválení" />
      <div className="max-w-4xl p-4 sm:p-8">
        <CompactBalances />


        {rows.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Hledat v poznámce…"
                aria-label="Hledat v žádostech"
                className="w-full min-w-[12rem] rounded border border-line bg-white py-2 pl-8 pr-3 text-sm sm:w-64"
              />
            </div>
            <Select
              value={yearFilter}
              onValueChange={(v) => {
                setYearFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-32" aria-label="Filtr podle roku">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Celé období</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    Rok {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-48" aria-label="Filtr podle typu absence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny typy</SelectItem>
                {types.map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => setSortDesc((v) => !v)}
              className="flex items-center gap-1.5 rounded border border-line bg-white px-3 py-2 text-sm text-muted hover:bg-paper"
              title="Řazení podle data konání"
            >
              {sortDesc ? <ArrowDown size={14} /> : <ArrowUp size={14} />} {sortDesc ? "Nejnovější nahoře" : "Nejstarší nahoře"}
            </button>
            <div className="ml-auto flex overflow-hidden rounded border border-line">
              <button
                onClick={() => setView("cards")}
                aria-label="Karty"
                title="Karty"
                className={cn("p-2", view === "cards" ? "bg-teal-light text-teal-dark" : "text-muted hover:bg-paper")}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setView("table")}
                aria-label="Kompaktní tabulka"
                title="Kompaktní tabulka"
                className={cn("border-l border-line p-2", view === "table" ? "bg-teal-light text-teal-dark" : "text-muted hover:bg-paper")}
              >
                <Table2 size={15} />
              </button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(
              [
                ["all", "Všechny"],
                ["pending", "⏳ Čekající"],
                ["approved", "🟢 Schválené"],
                ["rejected", "🔴 Zamítnuté"],
              ] as [StatusTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setStatusTab(key);
                  setPage(0);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  statusTab === key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper"
                )}
              >
                {label} ({count(key)})
              </button>
            ))}
          </div>
        )}
        {actionError && <p className="mb-3 rounded bg-danger-light px-3 py-2 text-sm text-danger">{actionError}</p>}

        {loading && <LoadingLines rows={4} />}
        {!loading && rows.length === 0 && <div className="card p-8 text-center text-sm text-muted">Zatím jste nepodal žádnou žádost.</div>}
        {!loading && rows.length > 0 && filteredRows.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">Žádné žádosti pro zvolený filtr.</div>
        )}

        {filteredRows.length > 0 && view === "cards" && (
          <div className="card divide-y divide-line">
            {shownRows.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <LeaveBadge type={r.leave_type} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{formatRange(r.start_date, r.end_date)}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatNumber(Number(r.working_days))} {dayWord(Number(r.working_days))}
                        {Number(r.working_days) === 0 && <span className="ml-1 rounded-sm bg-paper px-1.5 py-0.5 text-[11px] ring-1 ring-line">víkend nebo svátek</span>}
                        {r.approver && <> · {r.status === "rejected" ? "Zamítl" : "Schválil"}: {r.approver.name}</>}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={r.status} className="shrink-0" title={r.status === "rejected" ? (r.rejection_reason ?? undefined) : undefined} />
                </div>

                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-2 rounded border border-danger/20 bg-danger-light px-3 py-2 text-xs text-danger">Důvod zamítnutí: {r.rejection_reason}</p>
                )}
                {r.note && (
                  <p className="mt-2 text-xs text-muted">
                    <span className="font-medium">Poznámka:</span> {r.note}
                  </p>
                )}

                <div className="mt-3">{renderActions(r, true)}</div>
              </div>
            ))}
          </div>
        )}

        {filteredRows.length > 0 && view === "table" && (
          <div className="card max-h-[75vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-paper">
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Typ</th>
                  <th className="px-3 py-2.5 font-medium">Termín</th>
                  <th className="px-3 py-2.5 font-medium">Dní</th>
                  <th className="px-3 py-2.5 font-medium">Stav</th>
                  <th className="px-3 py-2.5 font-medium">Zástup</th>
                  <th className="px-3 py-2.5 font-medium">Poznámka</th>
                  <th className="px-3 py-2.5 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody>
                {shownRows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-2">
                      <LeaveBadge type={r.leave_type} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{formatRange(r.start_date, r.end_date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {formatNumber(Number(r.working_days))}
                      {Number(r.working_days) === 0 && <span className="ml-1 rounded-sm bg-paper px-1.5 py-0.5 text-[11px] ring-1 ring-line">víkend/svátek</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} title={r.status === "rejected" ? (r.rejection_reason ?? undefined) : undefined} />
                      {r.status === "rejected" && r.rejection_reason && <div className="mt-1 max-w-[200px] text-xs text-danger">{r.rejection_reason}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {r.covering_profile_id ? <span className="text-ink">{coverNames[r.covering_profile_id] ?? "…"}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-muted">
                      <span className="line-clamp-2" title={r.note ?? undefined}>
                        {r.note || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{renderActions(r, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredRows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
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
              {currentPage * pageSize + 1}–{Math.min(filteredRows.length, (currentPage + 1) * pageSize)} z {filteredRows.length}
            </span>
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
          </div>
        )}
      </div>

      {editingRow && (
        <RequestLeaveModal
          trigger={null}
          open={!!editingRow}
          onOpenChange={(o) => !o && setEditingRow(null)}
          editingRequest={{
            id: editingRow.id,
            leave_type_id: editingRow.leave_type.id,
            start_date: editingRow.start_date,
            end_date: editingRow.end_date,
            half_day: editingRow.half_day,
            working_days: editingRow.working_days,
            note: editingRow.note,
            covering_profile_id: editingRow.covering_profile_id,
          }}
          onSaved={() => {
            setEditingRow(null);
            load();
          }}
        />
      )}

      {resubmitRow && (
        <RequestLeaveModal
          trigger={null}
          open={!!resubmitRow}
          onOpenChange={(o) => !o && setResubmitRow(null)}
          prefill={{
            leave_type_id: resubmitRow.leave_type.id,
            half_day: resubmitRow.half_day,
            start_date: resubmitRow.start_date,
            end_date: resubmitRow.end_date,
            note: resubmitRow.note,
            covering_profile_id: resubmitRow.covering_profile_id,
          }}
          onSaved={() => {
            setResubmitRow(null);
            load();
          }}
        />
      )}
    </div>
  );
}
