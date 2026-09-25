"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange } from "@/lib/working-days";
import { addDays, format, isWeekend, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ABSENT_TYPE } from "@/lib/leave-kinds";
import { fetchMaskedAbsences } from "@/lib/data";
import { TeamCapacity } from "@/components/dashboard/TeamCapacity";
import { LoadingLines } from "@/components/ui/skeleton";

interface Row {
  id: string;
  start_date: string;
  end_date: string;
  covering_profile_id: string | null;
  leave_type: { key: string; label: string; color: "teal" | "rust" | "moss" | "violet" | "amber" } | null;
  profile: { id: string; name: string; avatar_initials: string | null } | null;
  department: { name: string } | null;
}

const colorDot: Record<string, string> = {
  teal: "bg-teal", rust: "bg-rust", moss: "bg-moss", violet: "bg-violet", amber: "bg-amber", sky: "bg-sky",
  plum: "bg-plum", sage: "bg-sage", gold: "bg-gold", wine: "bg-wine", slate: "bg-slate", forest: "bg-forest",
};

export function WhoIsOutToday() {
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [coverNames, setCoverNames] = useState<Record<string, string>>({});
  const [tip, setTip] = useState<{ x: number; y: number; name: string; req: Row } | null>(null);
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [tip !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toLocaleDateString("sv-SE");
    const horizon = addDays(new Date(), 10).toLocaleDateString("sv-SE");
    const weekStartISO = addDays(new Date(), -((new Date().getDay() + 6) % 7)).toLocaleDateString("sv-SE");

    supabase
      .from("leave_requests")
      .select(
        `id, start_date, end_date, covering_profile_id,
         leave_type:leave_types(key, label, color),
         profile:profiles!leave_requests_profile_id_fkey(id, name, avatar_initials, department:departments!profiles_department_id_fkey(name))`
      )
      .eq("status", "approved")
      .lte("start_date", horizon)
      .gte("end_date", weekStartISO)
      .order("start_date", { ascending: true })
      .then(async ({ data }) => {
        // Private absences of colleagues (e.g. sick leave) come without a type — shown as "Nepřítomen".
        const masked = (await fetchMaskedAbsences(weekStartISO, horizon)).filter((m) => m.status === "approved");
        let maskedProfiles: Record<string, { id: string; name: string; avatar_initials: string | null; department: { name: string } | null }> = {};
        if (masked.length > 0) {
          const { data: ps } = await supabase
            .from("profiles")
            .select("id, name, avatar_initials, department:departments!profiles_department_id_fkey(name)")
            .in("id", Array.from(new Set(masked.map((m) => m.profile_id))));
          maskedProfiles = Object.fromEntries(((ps as unknown as { id: string; name: string; avatar_initials: string | null; department: { name: string } | null }[]) ?? []).map((p) => [p.id, p]));
        }
        const hiddenRows = masked
          .filter((m) => maskedProfiles[m.profile_id])
          .map((m) => ({
            id: m.id,
            start_date: m.start_date,
            end_date: m.end_date,
            covering_profile_id: null,
            leave_type: ABSENT_TYPE as unknown as Row["leave_type"],
            profile: maskedProfiles[m.profile_id],
            department: maskedProfiles[m.profile_id].department,
          }));
        const mapped = ((data as unknown[]) ?? []).map((r) => {
          const row = r as {
            id: string;
            start_date: string;
            end_date: string;
            covering_profile_id: string | null;
            leave_type: Row["leave_type"];
            profile: { id: string; name: string; avatar_initials: string | null; department: { name: string } | null } | null;
          };
          return {
            id: row.id,
            start_date: row.start_date,
            end_date: row.end_date,
            covering_profile_id: row.covering_profile_id,
            leave_type: row.leave_type,
            profile: row.profile,
            department: row.profile?.department ?? null,
          };
        });
        setAllRows([...mapped, ...hiddenRows].sort((a, b) => a.start_date.localeCompare(b.start_date)));
        setLoading(false);
        const coverIds = Array.from(new Set(mapped.map((m) => m.covering_profile_id).filter((x): x is string => !!x)));
        if (coverIds.length > 0) {
          supabase
            .from("profiles")
            .select("id, name")
            .in("id", coverIds)
            .then(({ data: names }) => setCoverNames(Object.fromEntries((names ?? []).map((n) => [n.id as string, n.name as string]))));
        }
      });
  }, []);

  const todayISO = new Date().toLocaleDateString("sv-SE");
  const rows = useMemo(() => allRows.filter((r) => r.start_date <= todayISO && r.end_date >= todayISO), [allRows, todayISO]);

  // Mon–Fri of the current week (next week on weekends) as a compact timeline.
  const week = useMemo(() => {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = addDays(now, dow >= 5 ? 7 - dow : -dow);
    const days = Array.from({ length: 5 }, (_, i) => addDays(monday, i));
    const isos = days.map((d) => d.toLocaleDateString("sv-SE"));
    const byPerson = new Map<string, { name: string; cells: (Row | null)[] }>();
    for (const r of allRows) {
      if (!r.profile) continue;
      const cells = isos.map((iso) => (r.start_date <= iso && r.end_date >= iso ? r : null));
      if (cells.every((c) => !c)) continue;
      const cur = byPerson.get(r.profile.id) ?? { name: r.profile.name, cells: isos.map(() => null as Row | null) };
      cells.forEach((c, i) => c && (cur.cells[i] = c));
      byPerson.set(r.profile.id, cur);
    }
    return { days, isos, people: Array.from(byPerson.values()) };
  }, [allRows]);

  // Next 5 working days, so an empty "today" still tells you what is coming.
  const outlook = useMemo(() => {
    const days: { date: Date; label: string; people: Row[] }[] = [];
    let cursor = new Date();
    while (days.length < 5) {
      cursor = addDays(cursor, 1);
      if (isWeekend(cursor)) continue;
      const iso = cursor.toLocaleDateString("sv-SE");
      days.push({
        date: cursor,
        label: days.length === 0 && addDays(new Date(), 1).toDateString() === cursor.toDateString() ? "Zítra" : format(cursor, "EEEEEE d. M.", { locale: cs }),
        people: allRows.filter((r) => r.start_date <= iso && r.end_date >= iso),
      });
    }
    return days;
  }, [allRows]);

  const types = useMemo(() => {
    const map = new Map<string, { label: string; color: string }>();
    for (const r of rows) if (r.leave_type) map.set(r.leave_type.key, { label: r.leave_type.label, color: r.leave_type.color });
    return Array.from(map.entries());
  }, [rows]);

  const visibleRows = typeFilter ? rows.filter((r) => r.leave_type?.key === typeFilter) : rows;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-h2">Kdo dnes / tento týden chybí?</h2>
        <TeamCapacity />
      </div>

      {types.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter(null)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              typeFilter === null ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-paper"
            )}
          >
            Vše
          </button>
          {types.map(([key, t]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key === typeFilter ? null : key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                typeFilter === key ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-paper"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", colorDot[t.color])} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading && <LoadingLines rows={2} />}
        {!loading && rows.length === 0 && (
          <div>
            <p className="text-sm text-muted">Dnes je celý tým přítomen.</p>
            {outlook.some((d) => d.people.length > 0) ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {outlook
                  .filter((d) => d.people.length > 0)
                  .slice(0, 3)
                  .map((d) => (
                    <li key={d.label}>
                      <span className="font-medium">
                        <span className="capitalize">{d.label}</span> chybí:
                      </span>{" "}
                      <span className="text-muted">{d.people.map((p) => `${p.profile?.name} (${p.leave_type?.label})`).join(", ")}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">Ani v následujících dnech nikdo nechybí.</p>
            )}
          </div>
        )}
        {!loading && rows.length > 0 && visibleRows.length === 0 && (
          <p className="text-sm text-muted">Nikdo neodpovídá zvolenému filtru.</p>
        )}
        {visibleRows.map((r) => {
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

      {!loading && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="grid grid-cols-[96px_repeat(5,1fr)] items-center gap-x-1 gap-y-1.5 text-[11px] text-muted">
            <span />
            {week.days.map((d, i) => (
              <span key={week.isos[i]} className={cn("text-center capitalize", week.isos[i] === todayISO && "font-semibold text-teal-dark underline decoration-2 underline-offset-4")}>
                {format(d, "EEEEEE d.", { locale: cs })}
              </span>
            ))}
            {week.people.length === 0 && <span className="col-span-6 py-2 text-center">Tento týden nikdo nechybí.</span>}
            {week.people.slice(0, 6).map((p) => (
              <Fragment key={p.name}>
                <span className="truncate text-xs text-ink" title={p.name}>{p.name}</span>
                {p.cells.map((c, i) => (
                  <span
                    key={i}
                    tabIndex={c ? 0 : undefined}
                    aria-label={c ? `${p.name}: ${c.leave_type?.label}, ${formatRange(c.start_date, c.end_date)}` : undefined}
                    onMouseEnter={c ? (e) => setTip({ x: e.clientX, y: e.clientY, name: p.name, req: c }) : undefined}
                    onMouseMove={c ? (e) => setTip({ x: e.clientX, y: e.clientY, name: p.name, req: c }) : undefined}
                    onMouseLeave={c ? () => setTip(null) : undefined}
                    onFocus={c ? (e) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left, y: b.bottom - 8, name: p.name, req: c }); } : undefined}
                    onBlur={c ? () => setTip(null) : undefined}
                    onClick={c ? (e) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left, y: b.bottom - 8, name: p.name, req: c }); } : undefined}
                    className={cn("h-4 rounded-sm", c ? colorDot[c.leave_type?.color ?? "teal"] : "bg-paper", week.isos[i] === todayISO && "ring-1 ring-inset ring-ink/40")}
                  />
                ))}
              </Fragment>
            ))}
          </div>
          {week.people.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
              {Array.from(new Map(week.people.flatMap((p) => p.cells).filter((c): c is Row => !!c && !!c.leave_type).map((c) => [c.leave_type!.key, c.leave_type!])).values()).map((t) => (
                <span key={t.key} className="flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-sm", colorDot[t.color])} /> {t.label}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted">Barevný pruh = nepřítomen, šedé pole = v práci. Dnešní den je podtržený a orámovaný.</p>
          {week.people.length > 6 && <p className="mt-1 text-[11px] text-muted">a dalších {week.people.length - 6}</p>}
        </div>
      )}
      {tip && (
        <div
          className="pointer-events-none fixed z-50 w-60 rounded-lg border border-line bg-white p-3 text-sm shadow-[0_8px_30px_rgba(22,35,59,0.16)]"
          style={{ left: Math.min(tip.x + 14, window.innerWidth - 256), top: tip.y + 14 }}
        >
          <div className="font-medium">{tip.name}</div>
          <div className="mt-1 text-xs">
            🌴 {tip.req.leave_type?.label} ({format(parseISO(tip.req.start_date), "EEEEEE d.", { locale: cs })}
            {tip.req.end_date !== tip.req.start_date && <> – {format(parseISO(tip.req.end_date), "EEEEEE d.", { locale: cs })}</>})
          </div>
          {tip.req.covering_profile_id && coverNames[tip.req.covering_profile_id] && (
            <div className="mt-1 text-xs">🔄 Zástup: {coverNames[tip.req.covering_profile_id]}</div>
          )}
        </div>
      )}
    </div>
  );
}
