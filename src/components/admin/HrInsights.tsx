"use client";

import { useEffect, useState } from "react";
import { addDays, format, getISOWeek, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarClock, Clock, HeartPulse, Scale, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { loadBalances, remainingOf } from "@/lib/balances";
import { DEFAULT_WORK_DAYS, dayWord } from "@/lib/working-days";
import { approvalSpeed, capacityHeatmap, sickShareByDepartment, vacationLiability, MIN_GROUP, type ApprovalSpeedRow, type HeatRow, type InRequest, type Liability } from "@/lib/insights";
import { cn, errorMessage, formatNumber } from "@/lib/utils";

interface Data {
  heat: HeatRow[];
  sick: ReturnType<typeof sickShareByDepartment>;
  speed: { rows: (ApprovalSpeedRow & { name: string })[]; overallMedianHours: number };
  liability: Liability;
  dailyCost: number | null;
  overdrawn: { name: string; remaining: number }[];
  forfeit: { name: string; days: number }[];
}

function Card({ icon, title, hint, children, className }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
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

const hours = (h: number) => (h < 1 ? "do hodiny" : h < 48 ? `${formatNumber(h)} h` : `${formatNumber(Math.round((h / 24) * 10) / 10)} dní`);

/**
 * HR Insights (admin + HR): předpověď kapacity, nemocnost jen souhrnně (nikdy po jménech), rychlost schvalování,
 * závazek z nevyčerpané dovolené a zůstatky. Výpočty jsou v lib/insights.ts.
 */
export function HrInsights({ departmentId = "all" }: { departmentId?: string }) {
  const { profile } = useAuth();
  const allowed = profile?.role === "admin" || profile?.staff_role === "hr";
  const isAdmin = profile?.role === "admin";
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState("");
  const [costMsg, setCostMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !allowed) return;
    const supabase = createClient();
    const now = new Date();
    const todayISO = format(now, "yyyy-MM-dd");
    const horizon = format(addDays(now, 7 * 13), "yyyy-MM-dd");
    const since90 = format(addDays(now, -90), "yyyy-MM-dd");

    (async () => {
      const q = supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id).eq("active", true);
      const [{ data: people }, { data: depts }, { data: reqs }, { data: company }, { data: hrs }, balances, { data: decisions }] = await Promise.all([
        departmentId === "all" ? q : q.eq("department_id", departmentId),
        supabase.from("departments").select("id, name, capacity_warning_percent").eq("company_id", profile.company_id),
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, status, leave_type:leave_types(key, counts_against, counts_as_present)")
          .in("status", ["approved", "pending"])
          .gte("end_date", since90)
          .lte("start_date", horizon),
        supabase.from("companies").select("capacity_warning_percent, max_carryover_days, work_days").eq("id", profile.company_id).single(),
        supabase.from("company_hr_settings").select("avg_daily_cost").eq("company_id", profile.company_id).maybeSingle(),
        loadBalances(profile.company_id),
        supabase
          .from("audit_log")
          .select("actor_id, entity_id, action, created_at")
          .in("action", ["request.approved", "request.rejected"])
          .gte("created_at", `${since90}T00:00:00`)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      type P = { id: string; name: string; department_id: string | null };
      const ppl = (people as unknown as P[]) ?? [];
      const ids = new Set(ppl.map((p) => p.id));
      const dps = (depts as unknown as { id: string; name: string; capacity_warning_percent: number | null }[]) ?? [];
      const workDays = (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const rs = ((reqs as unknown as InRequest[]) ?? []).filter((r) => ids.has(r.profile_id));

      const heat = capacityHeatmap({
        people: ppl,
        depts: dps.filter((d) => departmentId === "all" || d.id === departmentId),
        requests: rs.filter((r) => r.end_date >= todayISO),
        from: todayISO,
        weeks: 13,
        companyThresholdPct: Number(company?.capacity_warning_percent ?? 30),
        workDays,
      });

      const sick = sickShareByDepartment(
        ppl,
        dps,
        rs.filter((r) => r.status === "approved" && r.start_date <= todayISO),
        since90,
        todayISO,
        workDays
      );

      // Approval speed: when each decided request was submitted (created_at) vs. when it was decided (audit log).
      const decs = ((decisions as unknown as { actor_id: string | null; entity_id: string; action: string; created_at: string }[]) ?? []).filter((d) => d.entity_id);
      const entityIds = Array.from(new Set(decs.map((d) => d.entity_id)));
      const submitted = new Map<string, string>();
      for (let i = 0; i < entityIds.length; i += 200) {
        const { data: created } = await supabase.from("leave_requests").select("id, created_at").in("id", entityIds.slice(i, i + 200));
        for (const c of created ?? []) submitted.set(c.id as string, c.created_at as string);
      }
      const speed = approvalSpeed(decs, submitted, 3);
      const actorIds = speed.rows.map((r) => r.actorId);
      const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, name").in("id", actorIds) : { data: [] as { id: string; name: string }[] };
      const nameOf = new Map((actors ?? []).map((a) => [a.id as string, a.name as string]));

      // Vacation liability + named balance problems (vacation balances are not sensitive — everyone sees them).
      const maxCarry = company?.max_carryover_days !== null && company?.max_carryover_days !== undefined ? Number(company.max_carryover_days) : null;
      const remainingList: number[] = [];
      const overdrawn: Data["overdrawn"] = [];
      const forfeit: Data["forfeit"] = [];
      for (const p of ppl) {
        const b = balances.get(p.id, "vacation");
        if (b.total <= 0) continue;
        const rem = remainingOf(b);
        remainingList.push(rem);
        if (rem < 0) overdrawn.push({ name: p.name, remaining: rem });
        else if (maxCarry !== null && rem > maxCarry) forfeit.push({ name: p.name, days: rem - maxCarry });
      }
      overdrawn.sort((a, b) => a.remaining - b.remaining);
      forfeit.sort((a, b) => b.days - a.days);
      const dailyCost = hrs?.avg_daily_cost !== null && hrs?.avg_daily_cost !== undefined ? Number(hrs.avg_daily_cost) : null;

      setCostDraft(dailyCost !== null ? String(dailyCost) : "");
      setData({
        heat,
        sick,
        speed: { rows: speed.rows.map((r) => ({ ...r, name: nameOf.get(r.actorId) ?? "Neznámý schvalovatel" })), overallMedianHours: speed.overallMedianHours },
        liability: vacationLiability(remainingList, maxCarry, dailyCost),
        dailyCost,
        overdrawn: overdrawn.slice(0, 6),
        forfeit: forfeit.slice(0, 6),
      });
    })().catch((e) => {
      console.error("HrInsights failed:", e);
      setError(errorMessage(e));
    });
  }, [profile, allowed, departmentId]);

  async function saveCost() {
    if (!profile || !isAdmin) return;
    const n = costDraft.trim() === "" ? null : Number(costDraft.replace(",", "."));
    if (n !== null && (!Number.isFinite(n) || n < 0)) return setCostMsg("Zadejte kladné číslo.");
    const { error: err } = await createClient().from("company_hr_settings").upsert({ company_id: profile.company_id, avg_daily_cost: n }, { onConflict: "company_id" });
    setCostMsg(err ? errorMessage(err) : "Uloženo.");
    if (!err && data) setData({ ...data, dailyCost: n, liability: recompute(data, n) });
  }

  function recompute(d: Data, n: number | null): Liability {
    const perDay = n && n > 0 ? n : null;
    return { ...d.liability, amount: perDay ? Math.round(d.liability.totalDays * perDay) : null, forfeitAmount: perDay ? Math.round(d.liability.forfeitDays * perDay) : null };
  }

  if (!profile || !allowed) return null;
  if (error) return <p className="text-sm text-danger-dark">HR Insights se nepodařilo načíst: {error}</p>;
  if (!data) return null;

  const weekHeads = data.heat[0]?.weeks ?? [];
  const cellClass = (pct: number, breach: boolean, pending: number) =>
    cn(
      "flex h-8 items-center justify-center rounded text-[11px]",
      breach ? "bg-danger/70 font-medium text-white" : pct >= 20 ? "bg-warning/50" : pct > 0 ? "bg-teal/20" : "bg-paper text-muted",
      pending > 0 && "ring-2 ring-inset ring-warning/70"
    );

  return (
    <div>
      <h2 className="mb-3 text-label uppercase tracking-wide text-muted">HR Insights</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          className="lg:col-span-2"
          icon={<CalendarClock size={17} className="text-teal-dark" />}
          title="Předpověď kapacity na 13 týdnů"
          hint="Nejvyšší podíl nepřítomných v oddělení v daném týdnu (schválené absence). Rámeček = navíc čekající žádosti; červeně = překročený limit oddělení."
        >
          {data.heat.length === 0 ? (
            <Empty text="Zatím není co předpovídat (oddělení mají méně než 2 lidi)." />
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] items-center gap-1" style={{ gridTemplateColumns: `130px repeat(${weekHeads.length}, minmax(34px, 1fr))` }}>
                <span />
                {weekHeads.map((w) => (
                  <span key={w.weekStart} className="text-center text-[10px] text-muted" title={format(parseISO(w.weekStart), "d. M. yyyy", { locale: cs })}>
                    {getISOWeek(parseISO(w.weekStart))}
                  </span>
                ))}
                {data.heat.map((row) => (
                  <div key={row.deptId} className="contents">
                    <span className="truncate pr-2 text-xs" title={`${row.dept} (${row.size} lidí)`}>
                      {row.dept}
                    </span>
                    {row.weeks.map((c) => (
                      <div
                        key={c.weekStart}
                        className={cellClass(c.peakPct, c.breach, c.pendingPct)}
                        title={`${row.dept}, týden od ${format(parseISO(c.weekStart), "d. M.", { locale: cs })}: chybí ${c.peakCount} z ${row.size} (${c.peakPct} %)${c.pendingPct > 0 ? `, s čekajícími +${c.pendingPct} %` : ""}`}
                      >
                        {c.peakPct > 0 ? c.peakPct : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">Čísla nahoře jsou týdny v roce, v buňkách procento chybějících.</p>
            </div>
          )}
        </Card>

        <Card icon={<HeartPulse size={17} className="text-teal-dark" />} title="Nemocnost (souhrnně)" hint={`Posledních 90 dní. Jen oddělení s alespoň ${MIN_GROUP} lidmi, nikdy jména ani jednotlivci.`}>
          {data.sick.rows.length === 0 && !data.sick.company && <Empty text="Málo lidí na smysluplný souhrn." />}
          {data.sick.company && <Row left={`Celá firma (${data.sick.company.size} lidí)`} right={`${formatNumber(data.sick.company.sharePct)} % pracovních dnů`} />}
          {data.sick.rows.map((r) => (
            <Row key={r.dept} left={`${r.dept} (${r.size})`} right={`${formatNumber(r.sharePct)} %`} tone={data.sick.company && r.sharePct >= data.sick.company.sharePct * 1.5 && r.sharePct >= 2 ? "warning" : undefined} />
          ))}
          {data.sick.hiddenDepartments > 0 && <p className="text-xs text-muted">Menší oddělení ({data.sick.hiddenDepartments}) se z důvodu ochrany soukromí nezobrazují.</p>}
        </Card>

        <Card icon={<Clock size={17} className="text-teal-dark" />} title="Rychlost schvalování" hint="Jak dlouho žádost čeká na rozhodnutí — medián za posledních 90 dní, schvalovatelé s aspoň 3 rozhodnutími.">
          {data.speed.rows.length === 0 ? (
            <Empty text="Zatím málo rozhodnutí." />
          ) : (
            <>
              <Row left="Celkem (medián)" right={hours(data.speed.overallMedianHours)} />
              {data.speed.rows.map((r) => (
                <Row key={r.actorId} left={`${r.name} · ${r.decisions}×`} right={`${hours(r.medianHours)}${r.rejectedPct > 0 ? ` · zamítá ${r.rejectedPct} %` : ""}`} tone={r.medianHours >= 48 ? "danger" : r.medianHours >= 24 ? "warning" : undefined} />
              ))}
            </>
          )}
        </Card>

        <Card icon={<Wallet size={17} className="text-teal-dark" />} title="Závazek z nevyčerpané dovolené" hint="Součet nevyčerpaných dní; dny nad strop převodu propadnou. Částka podle průměrných denních nákladů.">
          <Row left="Nevyčerpáno celkem" right={`${formatNumber(data.liability.totalDays)} ${dayWord(data.liability.totalDays)}${data.liability.amount !== null ? ` · ${data.liability.amount.toLocaleString("cs-CZ")} Kč` : ""}`} />
          <Row left="Propadne při převodu" right={`${formatNumber(data.liability.forfeitDays)} ${dayWord(data.liability.forfeitDays)}${data.liability.forfeitAmount !== null ? ` · ${data.liability.forfeitAmount.toLocaleString("cs-CZ")} Kč` : ""}`} tone={data.liability.forfeitDays > 0 ? "warning" : undefined} />
          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="text-xs text-muted" htmlFor="avg-cost">
                Průměrné denní náklady na osobu (Kč):
              </label>
              <input
                id="avg-cost"
                inputMode="decimal"
                value={costDraft}
                onChange={(e) => {
                  setCostDraft(e.target.value);
                  setCostMsg(null);
                }}
                onBlur={saveCost}
                placeholder="např. 2 500"
                className="w-28 rounded border border-line px-2 py-1 text-right text-sm"
              />
              {costMsg && <span className="text-xs text-muted">{costMsg}</span>}
            </div>
          ) : (
            data.dailyCost === null && <p className="text-xs text-muted">Sazbu pro přepočet na koruny nastavuje admin.</p>
          )}
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
