"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, isWeekend, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { AlertTriangle, Calendar, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { approveLeaveRequest, fetchMaskedAbsences, rejectLeaveRequest } from "@/lib/data";
import { LeaveBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { dayWord, formatRange } from "@/lib/working-days";
import { fetchCompany } from "@/lib/admin-data";
import { LeaveColor } from "@/lib/supabase/types";
import { cn, formatNumber } from "@/lib/utils";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { emitDataChanged, useOnDataChanged } from "@/lib/events";
import { ABSENT_TYPE, reducesPresence } from "@/lib/leave-kinds";
import { fairnessHint, mainPeriodOf, type InRequest } from "@/lib/insights";
import { computeApprovalWarnings, fetchMyDepartmentIds, hasOtherApprover } from "@/lib/approval-checks";
import { fetchDecisionScope } from "@/lib/approval-scope";
import { LoadingCard } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";

interface PendingRow {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  note: string | null;
  leave_type: { key: string; label: string; color: LeaveColor; counts_against: "vacation" | "sick" | "none" };
  profile: {
    id: string;
    name: string;
    avatar_initials: string | null;
    manager_id: string | null;
    department_id: string | null;
    department: { name: string } | null;
  };
}

export function PendingApprovals() {
  const { profile } = useAuth();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  // Hint for requests in a main period (Christmas, summer): did the person have the same period last year?
  const [fairness, setFairness] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState<Record<string, number>>({});
  const [capacityWarnings, setCapacityWarnings] = useState<Record<string, { percent: number; count: number; size: number }>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "conflict" | "clean">("all");
  const [calendarOpenId, setCalendarOpenId] = useState<string | null>(null);
  // Odkaz „Detail“ z nástěnky (?zadost=ID): žádost se najde, zvýrazní a otevře se její kalendář.
  const focusParam = useSearchParams().get("zadost");
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusedOnce = useRef<string | null>(null);
  const [myDepts, setMyDepts] = useState<Set<string>>(new Set());
  const isMyTeam = (p: { manager_id: string | null; department_id: string | null }) =>
    p.manager_id === profile?.id || (!!p.department_id && myDepts.has(p.department_id));

  useOnDataChanged(() => load());

  async function load() {
    if (!profile) return;
    const supabase = createClient();
    const year = new Date().getFullYear();

    const { data } = await supabase
      .from("leave_requests")
      .select(
        `id, start_date, end_date, working_days, note,
         leave_type:leave_types(key, label, color, counts_against),
         profile:profiles!leave_requests_profile_id_fkey(id, name, avatar_initials, manager_id, department_id, department:departments!profiles_department_id_fkey(name))`
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    // Direct reports first (matches "auto-assigned approver" — this manager
    // is the one actually meant to act on those); Array.sort is stable, so
    // the FIFO order from the query above is preserved within each group.
    const mine = await fetchMyDepartmentIds(profile.company_id, profile.id);
    setMyDepts(mine);
    const otherApprover = await hasOtherApprover(profile.company_id, profile.id);
    // Only requests this approver may decide: their people (manager / department head / deputy / substitute) or everything for an admin.
    const scope = await fetchDecisionScope(profile);
    const rows = ((data as unknown as PendingRow[]) ?? [])
      .filter((r) => scope.canDecide(r.profile))
      .filter((r) => !otherApprover || r.profile.id !== profile.id)
      .sort((a, b) => {
      const aMine = a.profile.manager_id === profile.id || (a.profile.department_id && mine.has(a.profile.department_id)) ? 0 : 1;
      const bMine = b.profile.manager_id === profile.id || (b.profile.department_id && mine.has(b.profile.department_id)) ? 0 : 1;
      return aMine - bMine;
    });
    setPending(rows);

    // Conflict = colleagues from the SAME department who already have approved leave overlapping the request
    // (home office doesn't count). Same rule as the capacity warning and the calendar preview below.
    const conflictMap: Record<string, string> = {};
    // Private absences (sick leave) of people this approver doesn't supervise arrive without a type.
    const hiddenAll = (await fetchMaskedAbsences()).filter((m) => m.status === "approved");
    const { data: coProfiles } = hiddenAll.length
      ? await supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id)
      : { data: [] as { id: string; name: string; department_id: string | null }[] };
    const coById = new Map((coProfiles ?? []).map((p) => [p.id, p]));
    // One query for all pending requests together (instead of one per request), matched in memory below.
    type Overlap = { start_date: string; end_date: string; profile_id: string; leave_type: { key: string } | null; profile: { name: string; department_id: string | null } | null };
    let allOverlaps: Overlap[] = [];
    if (rows.length > 0) {
      const minStart = rows.reduce((m, r) => (r.start_date < m ? r.start_date : m), rows[0].start_date);
      const maxEnd = rows.reduce((m, r) => (r.end_date > m ? r.end_date : m), rows[0].end_date);
      const { data: ov } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, profile_id, leave_type:leave_types(key), profile:profiles!leave_requests_profile_id_fkey(name, department_id)")
        .eq("status", "approved")
        .lte("start_date", maxEnd)
        .gte("end_date", minStart);
      allOverlaps = (ov as unknown as Overlap[]) ?? [];
    }
    for (const r of rows) {
      if (!reducesPresence(r.leave_type.key) || !r.profile.department_id) continue;
      const overlap = allOverlaps.filter((o) => o.profile_id !== r.profile.id && o.start_date <= r.end_date && o.end_date >= r.start_date);
      const hiddenNames = hiddenAll
        .filter((m) => m.profile_id !== r.profile.id && m.start_date <= r.end_date && m.end_date >= r.start_date && coById.get(m.profile_id)?.department_id === r.profile.department_id)
        .map((m) => coById.get(m.profile_id)!.name);
      const names = Array.from(
        new Set([
          ...((overlap as unknown as { leave_type: { key: string } | null; profile: { name: string; department_id: string | null } | null }[]) ?? [])
            .filter((o) => reducesPresence(o.leave_type?.key) && o.profile?.department_id === r.profile.department_id)
            .map((o) => o.profile!.name),
          ...hiddenNames,
        ])
      );
      if (names.length > 0) conflictMap[r.id] = names.length > 1 ? `${names[0]} a dalších ${names.length - 1}` : names[0];
    }
    setConflicts(conflictMap);

    // Fairness of main periods: one query for the last two years of approved vacations of all requesters.
    const periodRows = rows.filter((r) => mainPeriodOf(r));
    if (periodRows.length > 0) {
      const since = `${new Date().getFullYear() - 1}-01-01`;
      const { data: past } = await supabase
        .from("leave_requests")
        .select("profile_id, start_date, end_date, working_days, status, leave_type:leave_types(key, counts_against)")
        .eq("status", "approved")
        .in("profile_id", Array.from(new Set(periodRows.map((r) => r.profile.id))))
        .gte("end_date", since);
      const all = (past as unknown as InRequest[]) ?? [];
      const hints: Record<string, string> = {};
      for (const r of periodRows) {
        const h = fairnessHint(r, all.filter((x) => x.profile_id === r.profile.id));
        if (h) hints[r.id] = h;
      }
      setFairness(hints);
    } else {
      setFairness({});
    }

    // Remaining balance after approval: entitlement total minus already-approved usage
    // minus this pending request's days, per profile + counts_against category.
    const warnings = await computeApprovalWarnings(
      profile.company_id,
      rows.map((r) => ({
        id: r.id,
        start_date: r.start_date,
        end_date: r.end_date,
        working_days: r.working_days,
        counts_against: r.leave_type.counts_against,
        type_key: r.leave_type.key,
        profile: { id: r.profile.id, department_id: r.profile.department_id },
      }))
    );
    setRemaining(warnings.remaining);
    setCapacityWarnings(warnings.capacity);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    if (!focusParam || focusedOnce.current === focusParam || !pending.some((r) => r.id === focusParam)) return;
    focusedOnce.current = focusParam; // jen jednou, ať se pozornost nevrací při dalším načtení seznamu
    setFilter("all");
    setFocusId(focusParam);
    setCalendarOpenId(focusParam);
    setTimeout(() => document.getElementById(`zadost-${focusParam}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    setTimeout(() => setFocusId(null), 5000);
  }, [focusParam, pending]);

  async function approve(id: string) {
    if (!profile) return;
    await approveLeaveRequest(id, profile.id);
    emitDataChanged();
  }

  async function reject(id: string, reason: string) {
    if (!profile) return;
    await rejectLeaveRequest(id, profile.id, reason);
    emitDataChanged();
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasWarning = (r: PendingRow) => !!conflicts[r.id] || !!capacityWarnings[r.id] || (remaining[r.id] !== undefined && remaining[r.id] < 0);
  const conflictCount = pending.filter(hasWarning).length;
  const visible = pending.filter((r) => (filter === "all" ? true : filter === "conflict" ? hasWarning(r) : !hasWarning(r)));
  const selectedRows = pending.filter((r) => selected.has(r.id));
  const selectedWarnings = selectedRows.filter(hasWarning).length;
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function toggleSelectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function approveSelected() {
    if (!profile || selectedRows.length === 0) return;
    if (
      selectedWarnings > 0 &&
      !(await confirmDialog(`${selectedWarnings} z vybraných žádostí má varování (konflikt v týmu, kapacita nebo minus). Přesto schválit všech ${selectedRows.length}?`, {
        confirmLabel: "Schválit vše",
      }))
    )
      return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedRows.map((r) => approveLeaveRequest(r.id, profile.id)));
      setSelected(new Set());
      emitDataChanged();
    } finally {
      setBulkBusy(false);
    }
  }

  async function rejectSelected(reason: string) {
    if (!profile) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedRows.map((r) => rejectLeaveRequest(r.id, profile.id, reason)));
      setSelected(new Set());
      emitDataChanged();
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return <LoadingCard rows={5} />;
  }

  if (pending.length === 0) {
    return <div className="card p-8 text-center text-sm text-muted">Žádné žádosti nečekají na schválení. 🎉</div>;
  }

  const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ["all", `Všechny (${pending.length})`],
            ["conflict", `⚠️ S konfliktem (${conflictCount})`],
            ["clean", `✓ Bez konfliktu (${pending.length - conflictCount})`],
          ] as [typeof filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-4 border-b border-line bg-paper px-5 py-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="h-4 w-4 rounded border-line accent-teal" />
            Vybrat vše ({visible.length})
          </label>
        </div>

        {visible.length === 0 && <div className="p-8 text-center text-sm text-muted">V tomto filtru nic není.</div>}

        <div className="divide-y divide-line">
          {visible.map((r) => (
            <div key={r.id} id={`zadost-${r.id}`} className={cn("scroll-mt-24 p-4 transition-colors sm:p-5", focusId === r.id && "bg-teal-light/40 ring-2 ring-inset ring-teal")}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    className="h-4 w-4 shrink-0 rounded border-line accent-teal"
                    aria-label={`Vybrat žádost od ${r.profile.name}`}
                  />
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-medium">{r.profile.avatar_initials}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{r.profile.name}</span>
                      {r.profile.department?.name && <span className="text-xs text-muted">· {r.profile.department.name}</span>}
                      {isMyTeam(r.profile) && <span className="rounded-sm bg-teal-light px-1.5 py-0.5 text-[11px] font-medium text-teal-dark">Váš tým</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <LeaveBadge type={r.leave_type} />
                      <span>{formatRange(r.start_date, r.end_date)}</span>
                      <span>
                        · {formatNumber(Number(r.working_days))} {dayWord(Number(r.working_days))}
                      </span>
                    </div>
                    {fairness[r.id] && <div className="mt-1 text-xs text-muted">🎄 {fairness[r.id]}</div>}
                    {r.leave_type.counts_against !== "none" && remaining[r.id] !== undefined && remaining[r.id] >= 0 && (
                      <div className="mt-1 text-xs text-muted">
                        Po schválení zbude: <span className="font-medium text-ink">{formatNumber(Number(remaining[r.id]))} dní</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCalendarOpenId(calendarOpenId === r.id ? null : r.id)}
                    aria-expanded={calendarOpenId === r.id}
                    className="flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-teal-dark hover:bg-teal-light"
                  >
                    <Calendar size={14} /> {calendarOpenId === r.id ? "Skrýt kalendář" : "Zobrazit v kalendáři"}
                  </button>
                  <RejectDialog onConfirm={(reason) => reject(r.id, reason)} />
                  <Button variant="primary" onClick={() => approve(r.id)}>
                    <Check size={16} /> Schválit
                  </Button>
                </div>
              </div>

              {hasWarning(r) && (
                <div className="mt-2.5 flex flex-wrap gap-2 sm:pl-[3.25rem]">
                  {capacityWarnings[r.id] && (
                    <span className={cn(pill, "bg-danger-light text-danger-dark")}>
                      <AlertTriangle size={13} /> Vysoké riziko: výpadek {capacityWarnings[r.id].percent} % oddělení ({capacityWarnings[r.id].count} z {capacityWarnings[r.id].size})
                    </span>
                  )}
                  {conflicts[r.id] && (
                    <span className={cn(pill, "bg-warning-light text-warning-dark")}>
                      <AlertTriangle size={13} /> Konflikt s {conflicts[r.id]}
                    </span>
                  )}
                  {remaining[r.id] !== undefined && remaining[r.id] < 0 && (
                    <span className={cn(pill, "bg-danger-light text-danger-dark")}>
                      <AlertTriangle size={13} /> Po schválení zůstatek {formatNumber(Number(remaining[r.id]))} dní (minus)
                    </span>
                  )}
                </div>
              )}

              {calendarOpenId === r.id && (
                <div className="mt-3 sm:pl-[3.25rem]">
                  <OverlapPreview request={r} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 shadow-[0_8px_30px_rgba(22,35,59,0.18)]">
          <div className="text-sm">
            <span className="font-medium">Vybráno {selected.size}</span>
            {selectedWarnings > 0 && <span className="ml-2 text-warning-dark">⚠️ {selectedWarnings} z vybraných má varování</span>}
          </div>
          <div className="flex gap-2">
            <BulkRejectDialog count={selected.size} disabled={bulkBusy} onConfirm={rejectSelected} />
            <Button variant="primary" onClick={approveSelected} disabled={bulkBusy}>
              <Check size={16} /> {bulkBusy ? "Pracuji…" : `Schválit vybrané (${selected.size})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Week-style preview of who else is out around the requested dates (same department, home office excluded). */
function OverlapPreview({ request }: { request: PendingRow }) {
  const [rows, setRows] = useState<{ id: string; name: string; start_date: string; end_date: string; color: LeaveColor; label: string }[] | null>(null);

  const from = addDays(parseISO(request.start_date), -2);
  const spanDays = Math.min(14, differenceInCalendarDays(parseISO(request.end_date), from) + 3);
  const days = Array.from({ length: Math.max(spanDays, 5) }, (_, i) => addDays(from, i));
  const isos = days.map((d) => d.toLocaleDateString("sv-SE"));

  useEffect(() => {
    if (!request.profile.department_id) {
      setRows([]);
      return;
    }
    const sb = createClient();
    Promise.all([
      sb
        .from("leave_requests")
        .select("id, start_date, end_date, leave_type:leave_types(key, label, color), profile:profiles!leave_requests_profile_id_fkey(id, name, department_id)")
        .eq("status", "approved")
        .lte("start_date", isos[isos.length - 1])
        .gte("end_date", isos[0]),
      fetchMaskedAbsences(isos[0], isos[isos.length - 1]),
    ]).then(async ([{ data }, masked]) => {
        const hiddenIds = Array.from(new Set(masked.filter((m) => m.status === "approved").map((m) => m.profile_id)));
        const { data: hp } = hiddenIds.length ? await sb.from("profiles").select("id, name, department_id").in("id", hiddenIds) : { data: [] as { id: string; name: string; department_id: string | null }[] };
        const hpById = new Map((hp ?? []).map((p) => [p.id, p]));
        const hiddenRows = masked
          .filter((m) => m.status === "approved" && hpById.get(m.profile_id)?.department_id === request.profile.department_id && m.profile_id !== request.profile.id)
          .map((m) => ({ id: m.id, name: hpById.get(m.profile_id)!.name, start_date: m.start_date, end_date: m.end_date, color: ABSENT_TYPE.color as LeaveColor, label: ABSENT_TYPE.label }));
        type R = { id: string; start_date: string; end_date: string; leave_type: { key: string; label: string; color: LeaveColor } | null; profile: { id: string; name: string; department_id: string | null } | null };
        setRows(
          ((data as unknown as R[]) ?? [])
            .filter((r) => r.profile?.department_id === request.profile.department_id && r.profile.id !== request.profile.id && r.leave_type && reducesPresence(r.leave_type.key))
            .map((r) => ({ id: r.id, name: r.profile!.name, start_date: r.start_date, end_date: r.end_date, color: r.leave_type!.color, label: r.leave_type!.label }))
            .concat(hiddenRows)
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  const inRange = (iso: string, a: string, b: string) => iso >= a && iso <= b;

  return (
    <div className="rounded border border-line bg-paper p-3">
      <div className="grid items-center gap-x-1 gap-y-1 text-[11px] text-muted" style={{ gridTemplateColumns: `110px repeat(${days.length}, minmax(20px, 1fr))` }}>
        <span />
        {days.map((d, i) => (
          <span key={isos[i]} className={cn("text-center", isWeekend(d) && "opacity-50")}>
            {format(d, "EEEEEE d.", { locale: cs })}
          </span>
        ))}
        <span className="truncate text-xs font-medium text-ink">{request.profile.name}</span>
        {isos.map((iso) => (
          <span key={iso} className={cn("h-4 rounded-sm", inRange(iso, request.start_date, request.end_date) ? "bg-teal opacity-70 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.6)_0_4px,transparent_4px_8px)]" : "bg-white")} />
        ))}
        {(rows ?? []).map((o) => (
          <Fragment key={o.id}>
            <span className="truncate text-xs text-ink" title={`${o.name} — ${o.label}`}>
              {o.name}
            </span>
            {isos.map((iso) => (
              <span key={iso} className={cn("h-4 rounded-sm", inRange(iso, o.start_date, o.end_date) ? colorBg[o.color] : "bg-white")} title={inRange(iso, o.start_date, o.end_date) ? o.label : undefined} />
            ))}
          </Fragment>
        ))}
      </div>
      {rows !== null && rows.length === 0 && <p className="mt-2 text-xs text-muted">V těchto dnech nikdo další z oddělení nechybí.</p>}
    </div>
  );
}

function BulkRejectDialog({ count, disabled, onConfirm }: { count: number; disabled: boolean; onConfirm: (reason: string) => void }) {
  return <RejectDialog onConfirm={onConfirm} label="Zamítnout vybrané" disabled={disabled} count={count} />;
}

function RejectDialog({ onConfirm, label = "Zamítnout", disabled, count }: { onConfirm: (reason: string) => void; label?: string; disabled?: boolean; count?: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setReason("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="danger" disabled={disabled}>
          <X size={16} /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent title={count ? `Zamítnout ${count} vybraných žádostí` : "Zamítnout žádost"}>
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="reject-reason">
            Důvod zamítnutí (zobrazí se zaměstnanci)
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Např. Kritický termín projektu"
            className="w-full rounded border border-line px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={() => {
                onConfirm(reason.trim());
                setOpen(false);
              }}
            >
              Potvrdit zamítnutí
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const colorBg: Record<LeaveColor, string> = {
  teal: "bg-teal", rust: "bg-rust", moss: "bg-moss", violet: "bg-violet", amber: "bg-amber", sky: "bg-sky",
  plum: "bg-plum", sage: "bg-sage", gold: "bg-gold", wine: "bg-wine", slate: "bg-slate", forest: "bg-forest",
};
