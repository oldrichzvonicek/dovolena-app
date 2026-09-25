"use client";

import { useEffect, useState } from "react";
import { addDays, format, getISOWeek, isWeekend, parseISO, startOfWeek } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarClock, Scale, Stethoscope } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { loadBalances, remainingOf } from "@/lib/balances";
import { reducesPresence } from "@/lib/leave-kinds";
import { dayWord } from "@/lib/working-days";
import { formatNumber } from "@/lib/utils";

interface Insights {
  weekendSick: { name: string; count: number; pct: number }[];
  highSick: { name: string; days: number; avg: number }[];
  capacity: { dept: string; week: string; percent: number; count: number; size: number }[];
  overdrawn: { name: string; remaining: number }[];
  forfeit: { name: string; days: number }[];
}

function Card({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 font-display text-h2">
        {icon} {title}
      </div>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

const Row = ({ left, right, tone }: { left: string; right: string; tone?: "danger" | "warning" }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-0">
    <span className="min-w-0 truncate">{left}</span>
    <span className={tone === "danger" ? "shrink-0 font-medium text-danger-dark" : tone === "warning" ? "shrink-0 font-medium text-warning-dark" : "shrink-0 text-muted"}>{right}</span>
  </div>
);

const Empty = ({ text }: { text: string }) => <p className="text-muted">✓ {text}</p>;

/** Admin insights: absence patterns, upcoming understaffing, balance problems. */
export function SmartInsights({ departmentId = "all" }: { departmentId?: string }) {
  const { profile } = useAuth();
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    const supabase = createClient();
    const now = new Date();
    const year = now.getFullYear();
    const todayISO = now.toLocaleDateString("sv-SE");
    const horizon = addDays(now, 60).toLocaleDateString("sv-SE");
    const since120 = addDays(now, -120).toLocaleDateString("sv-SE");

    (async () => {
      const [{ data: people }, { data: depts }, { data: reqs }, { data: company }, balances] = await Promise.all([
        departmentId === "all"
          ? supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id).eq("active", true)
          : supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id).eq("active", true).eq("department_id", departmentId),
        supabase.from("departments").select("id, name, capacity_warning_percent").eq("company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, leave_type:leave_types(key)")
          .eq("status", "approved")
          .gte("end_date", `${year}-01-01`)
          .lte("start_date", horizon),
        supabase.from("companies").select("capacity_warning_percent, max_carryover_days").eq("id", profile.company_id).single(),
        loadBalances(profile.company_id),
      ]);

      type P = { id: string; name: string; department_id: string | null };
      type R = { profile_id: string; start_date: string; end_date: string; working_days: number; leave_type: { key: string } | null };
      const ppl = (people as unknown as P[]) ?? [];
      const ids = new Set(ppl.map((p) => p.id));
      const rs = ((reqs as unknown as R[]) ?? []).filter((r) => ids.has(r.profile_id));
      const nameOf = new Map(ppl.map((p) => [p.id, p.name]));

      // 1a) short sick leaves clustered around weekends
      const sickRecent = rs.filter((r) => r.leave_type?.key === "sick" && r.start_date >= since120 && r.start_date <= todayISO);
      const byPerson = new Map<string, { n: number; edge: number }>();
      for (const r of sickRecent) {
        const dow = parseISO(r.start_date).getDay();
        const cur = byPerson.get(r.profile_id) ?? { n: 0, edge: 0 };
        cur.n += 1;
        if (dow === 1 || dow === 5) cur.edge += 1;
        byPerson.set(r.profile_id, cur);
      }
      const weekendSick = Array.from(byPerson.entries())
        .filter(([, v]) => v.n >= 3 && v.edge / v.n >= 0.6)
        .map(([id, v]) => ({ name: nameOf.get(id)!, count: v.n, pct: Math.round((v.edge / v.n) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 1b) unusually many sick days this year vs. company average
      const sickDays = new Map<string, number>();
      for (const r of rs.filter((x) => x.leave_type?.key === "sick" && x.start_date.startsWith(String(year)) && x.start_date <= todayISO)) {
        sickDays.set(r.profile_id, (sickDays.get(r.profile_id) ?? 0) + Number(r.working_days));
      }
      const avg = ppl.length > 0 ? Array.from(sickDays.values()).reduce((s, x) => s + x, 0) / ppl.length : 0;
      const highSick = Array.from(sickDays.entries())
        .filter(([, d]) => d >= Math.max(3, avg * 1.5))
        .map(([id, d]) => ({ name: nameOf.get(id)!, days: d, avg }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5);

      // 2) understaffing risk in the next 60 days per department/week
      const deptInfo = new Map(((depts as unknown as { id: string; name: string; capacity_warning_percent: number | null }[]) ?? []).map((d) => [d.id, d]));
      const companyThreshold = Number(company?.capacity_warning_percent ?? 30);
      const sizeByDept = new Map<string, number>();
      ppl.forEach((p) => p.department_id && sizeByDept.set(p.department_id, (sizeByDept.get(p.department_id) ?? 0) + 1));
      const deptOf = new Map(ppl.map((p) => [p.id, p.department_id]));
      const away = rs.filter((r) => reducesPresence(r.leave_type?.key));
      const peaks = new Map<string, { dept: string; weekStart: Date; percent: number; count: number; size: number }>();
      for (let i = 0; i <= 60; i++) {
        const d = addDays(now, i);
        if (isWeekend(d)) continue;
        const iso = d.toLocaleDateString("sv-SE");
        const perDept = new Map<string, Set<string>>();
        for (const r of away) {
          if (r.start_date <= iso && r.end_date >= iso) {
            const dep = deptOf.get(r.profile_id);
            if (dep) perDept.set(dep, (perDept.get(dep) ?? new Set()).add(r.profile_id));
          }
        }
        perDept.forEach((set, dep) => {
          const size = sizeByDept.get(dep) ?? 0;
          if (size < 2) return;
          const percent = Math.round((set.size / size) * 100);
          const threshold = deptInfo.get(dep)?.capacity_warning_percent ?? companyThreshold;
          if (percent < Math.max(threshold, 34)) return;
          const weekStart = startOfWeek(d, { weekStartsOn: 1 });
          const key = `${dep}-${weekStart.toISOString()}`;
          const cur = peaks.get(key);
          if (!cur || percent > cur.percent) peaks.set(key, { dept: deptInfo.get(dep)?.name ?? "Oddělení", weekStart, percent, count: set.size, size });
        });
      }
      const capacity = Array.from(peaks.values())
        .sort((a, b) => b.percent - a.percent)
        .slice(0, 5)
        .map((p) => ({
          dept: p.dept,
          week: `${getISOWeek(p.weekStart)}. týden (${format(p.weekStart, "d. M.", { locale: cs })})`,
          percent: p.percent,
          count: p.count,
          size: p.size,
        }));

      // 3) balances: overdrawn + days that will be lost at year-end because of the carryover cap
      const maxCarry = company?.max_carryover_days !== null && company?.max_carryover_days !== undefined ? Number(company.max_carryover_days) : null;
      const overdrawn: Insights["overdrawn"] = [];
      const forfeit: Insights["forfeit"] = [];
      for (const p of ppl) {
        const b = balances.get(p.id, "vacation");
        if (b.total <= 0) continue;
        const rem = remainingOf(b);
        if (rem < 0) overdrawn.push({ name: p.name, remaining: rem });
        else if (maxCarry !== null && rem > maxCarry) forfeit.push({ name: p.name, days: rem - maxCarry });
      }
      overdrawn.sort((a, b) => a.remaining - b.remaining);
      forfeit.sort((a, b) => b.days - a.days);

      setData({ weekendSick, highSick, capacity, overdrawn: overdrawn.slice(0, 6), forfeit: forfeit.slice(0, 6) });
    })().catch((e) => console.error("SmartInsights failed:", e));
  }, [profile, departmentId]);

  if (!profile || profile.role !== "admin" || !data) return null;

  return (
    <div>
      <h2 className="mb-3 text-label uppercase tracking-wide text-muted">Smart HR Insights</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card icon={<Stethoscope size={17} className="text-teal-dark" />} title="Vzorce absencí" hint="Posledních 120 dní a letošní rok">
          {data.weekendSick.length === 0 && data.highSick.length === 0 && <Empty text="Žádné nápadné vzorce." />}
          {data.weekendSick.map((p) => (
            <Row key={`w-${p.name}`} left={`${p.name} — nemoc kolem víkendu`} right={`${p.count}× (${p.pct} % po/pá)`} tone="warning" />
          ))}
          {data.highSick.map((p) => (
            <Row key={`h-${p.name}`} left={`${p.name} — hodně sick days`} right={`${formatNumber(p.days)} ${dayWord(p.days)} (ø ${formatNumber(Math.round(p.avg * 10) / 10)})`} tone="warning" />
          ))}
        </Card>

        <Card icon={<CalendarClock size={17} className="text-teal-dark" />} title="Riziko podkapacity" hint="Nejbližších 60 dní, po odděleních">
          {data.capacity.length === 0 && <Empty text="Žádný týden nevypadá kriticky." />}
          {data.capacity.map((c) => (
            <Row key={`${c.dept}-${c.week}`} left={`${c.dept} — ${c.week}`} right={`${c.count} z ${c.size} (${c.percent} %)`} tone={c.percent >= 60 ? "danger" : "warning"} />
          ))}
        </Card>

        <Card icon={<Scale size={17} className="text-teal-dark" />} title="Zůstatky" hint="V minusu a dny, které propadnou při přenosu">
          {data.overdrawn.length === 0 && data.forfeit.length === 0 && <Empty text="Všichni jsou v pořádku." />}
          {data.overdrawn.map((p) => (
            <Row key={`o-${p.name}`} left={`${p.name} — v minusu`} right={`${formatNumber(p.remaining)} dní`} tone="danger" />
          ))}
          {data.forfeit.map((p) => (
            <Row key={`f-${p.name}`} left={`${p.name} — propadne při přenosu`} right={`${formatNumber(p.days)} ${dayWord(p.days)}`} tone="warning" />
          ))}
        </Card>
      </div>
    </div>
  );
}
