"use client";

import { useEffect, useState } from "react";
import { addDays, format, getISOWeek, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { BatteryCharging, CalendarClock, Clock, HeartPulse, LineChart, Scale, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { loadBalances, remainingOf } from "@/lib/balances";
import { DEFAULT_WORK_DAYS, dayWord } from "@/lib/working-days";
import {
  MAIN_PERIODS,
  MIN_GROUP,
  approvalSpeed,
  capacityHeatmap,
  fairRota,
  monthlyTrend,
  periodWindow,
  rechargeScore,
  sickShareByDepartment,
  vacationLiability,
  type ApprovalSpeedRow,
  type HeatRow,
  type InRequest,
  type Liability,
  type MonthPoint,
  type RotaPerson,
} from "@/lib/insights";
import { cn, errorMessage, formatNumber } from "@/lib/utils";

interface Data {
  heat: HeatRow[];
  sick: ReturnType<typeof sickShareByDepartment>;
  speed: { rows: (ApprovalSpeedRow & { name: string })[]; overallMedianHours: number };
  liability: Liability;
  dailyCost: number | null;
  overdrawn: { name: string; remaining: number }[];
  forfeit: { name: string; days: number }[];
  trend: MonthPoint[]; // 24 měsíců (prvních 12 = předchozí rok)
  recharge: ReturnType<typeof rechargeScore>;
  rotaPeople: RotaPerson[];
  rotaRequests: InRequest[];
  deptNames: Map<string, string>;
  workDays: number[];
}

type TrendSeries = "absencePct" | "vacationPct" | "homeOfficePct" | "sickPct";
const SERIES: { key: TrendSeries; label: string }[] = [
  { key: "absencePct", label: "Absence celkem" },
  { key: "vacationPct", label: "Dovolená" },
  { key: "homeOfficePct", label: "Home Office" },
  { key: "sickPct", label: "Nemoc (souhrnně)" },
];

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
  const [series, setSeries] = useState<TrendSeries>("absencePct");
  const [periodKey, setPeriodKey] = useState(MAIN_PERIODS[0].key);

  useEffect(() => {
    if (!profile || !allowed) return;
    const supabase = createClient();
    const now = new Date();
    const todayISO = format(now, "yyyy-MM-dd");
    const horizon = format(addDays(now, 7 * 13), "yyyy-MM-dd");
    const since90 = format(addDays(now, -90), "yyyy-MM-dd");

    (async () => {
      const q = supabase.from("profiles").select("id, name, department_id").eq("company_id", profile.company_id).eq("active", true);
      const since24m = format(addDays(now, -740), "yyyy-MM-dd");
      const [{ data: people }, { data: depts }, { data: reqs }, { data: company }, { data: hrs }, balances, { data: decisions }, { data: history }] = await Promise.all([
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
        // Two years of approved / pending requests for trends, seasonal fairness and the "recharge" score.
        supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, working_days, status, leave_type:leave_types(key, counts_against, counts_as_present)")
          .in("status", ["approved", "pending"])
          .gte("end_date", since24m)
          .limit(8000),
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

      const hist = ((history as unknown as InRequest[]) ?? []).filter((r) => ids.has(r.profile_id));
      const trend = monthlyTrend(ppl.length, hist, format(now, "yyyy-MM"), 24, workDays);
      const recharge = rechargeScore(ppl, dps, hist, todayISO);

      setCostDraft(dailyCost !== null ? String(dailyCost) : "");
      setData({
        heat,
        sick,
        speed: { rows: speed.rows.map((r) => ({ ...r, name: nameOf.get(r.actorId) ?? "Neznámý schvalovatel" })), overallMedianHours: speed.overallMedianHours },
        liability: vacationLiability(remainingList, maxCarry, dailyCost),
        dailyCost,
        overdrawn: overdrawn.slice(0, 6),
        forfeit: forfeit.slice(0, 6),
        trend,
        recharge,
        rotaPeople: ppl.map((p) => ({ id: p.id, name: p.name, department_id: p.department_id })),
        rotaRequests: hist,
        deptNames: new Map(dps.map((d) => [d.id, d.name])),
        workDays,
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

        <Card
          className="lg:col-span-2"
          icon={<LineChart size={17} className="text-teal-dark" />}
          title="Trendy za 12 měsíců"
          hint="Podíl pracovních dnů všech lidí. Sloupec = poslední rok, čárka = stejný měsíc předchozího roku. Počítá se se současným počtem lidí."
        >
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zobrazená řada">
            {SERIES.map((sr) => (
              <button
                key={sr.key}
                onClick={() => setSeries(sr.key)}
                aria-pressed={series === sr.key}
                className={cn("rounded-full border px-3 py-1 text-xs", series === sr.key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper")}
              >
                {sr.label}
              </button>
            ))}
          </div>
          <TrendChart points={data.trend} series={series} />
          <Seasonality points={data.trend.slice(12)} series={series} />
        </Card>

        <Card icon={<BatteryCharging size={17} className="text-teal-dark" />} title="Dobití baterií" hint={`Podíl lidí, kteří v posledním půlroce měli souvislou dovolenou aspoň 5 dní. Jen souhrny, oddělení s aspoň ${MIN_GROUP} lidmi.`}>
          {data.recharge.company === null && data.recharge.rows.length === 0 && <Empty text="Málo lidí na smysluplný souhrn." />}
          {data.recharge.company && <Row left={`Celá firma (${data.recharge.company.size} lidí)`} right={`${data.recharge.company.pct} %`} tone={data.recharge.company.pct < 50 ? "warning" : undefined} />}
          {data.recharge.rows.map((r) => (
            <Row key={r.dept} left={`${r.dept} (${r.size})`} right={`${r.pct} %`} tone={r.pct < 40 ? "warning" : undefined} />
          ))}
          {data.recharge.hiddenDepartments > 0 && <p className="text-xs text-muted">Menší oddělení ({data.recharge.hiddenDepartments}) se z důvodu ochrany soukromí nezobrazují.</p>}
        </Card>

        <Card icon={<Users size={17} className="text-teal-dark" />} title="Férové plánování hlavních období" hint="Kdo měl loni totéž období a kdo letos už něco plánuje. Nahoře jsou ti, kdo loni neměli. Jen dovolená.">
          <div className="flex gap-1.5" role="group" aria-label="Období">
            {MAIN_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodKey(p.key)}
                aria-pressed={periodKey === p.key}
                className={cn("rounded-full border px-3 py-1 text-xs", periodKey === p.key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-paper")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <FairRota data={data} periodKey={periodKey} />
        </Card>
      </div>
    </div>
  );
}

/** Sloupcový graf (SVG): poslední rok jako sloupce, stejné měsíce loni jako čárky. */
function TrendChart({ points, series }: { points: MonthPoint[]; series: TrendSeries }) {
  const cur = points.slice(12);
  const prev = points.slice(0, 12);
  const val = (p?: MonthPoint) => (p ? (p[series] as number | null) : null);
  if (cur.every((p) => val(p) === null)) return <p className="text-muted">U této řady není dost lidí na smysluplný souhrn.</p>;
  const max = Math.max(1, ...cur.map((p) => val(p) ?? 0), ...prev.map((p) => val(p) ?? 0));
  const W = 720;
  const H = 150;
  const bw = W / 12;
  const monthLabel = (m: string) => format(parseISO(`${m}-01`), "LLL", { locale: cs });
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="min-w-[560px]" role="img" aria-label="Měsíční trend za poslední rok ve srovnání s předchozím rokem">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={H - H * t} y2={H - H * t} stroke="currentColor" className="text-line" strokeWidth={0.5} />
        ))}
        {cur.map((p, i) => {
          const v = val(p) ?? 0;
          const pv = val(prev[i]);
          const h = (v / max) * H;
          const x = i * bw + bw * 0.18;
          return (
            <g key={p.month}>
              <title>{`${monthLabel(p.month)} ${p.month.slice(0, 4)}: ${formatNumber(v)} %${pv !== null ? ` (loni ${formatNumber(pv)} %)` : ""}`}</title>
              <rect x={x} y={H - h} width={bw * 0.64} height={h} rx={3} className="fill-teal" opacity={0.85} />
              {pv !== null && <line x1={x - 2} x2={x + bw * 0.64 + 2} y1={H - (pv / max) * H} y2={H - (pv / max) * H} stroke="currentColor" className="text-ink" strokeWidth={2} />}
              <text x={x + bw * 0.32} y={H + 14} textAnchor="middle" className="fill-muted" fontSize={10}>
                {monthLabel(p.month)}
              </text>
              <text x={x + bw * 0.32} y={Math.max(10, H - h - 4)} textAnchor="middle" className="fill-ink" fontSize={9}>
                {v > 0 ? formatNumber(v) : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Nejsilnější a nejslabší měsíce posledního roku + meziroční změna. */
function Seasonality({ points, series }: { points: MonthPoint[]; series: TrendSeries }) {
  const vals = points.map((p) => ({ m: p.month, v: p[series] as number | null })).filter((x): x is { m: string; v: number } => x.v !== null);
  if (vals.length < 6) return null;
  const sorted = [...vals].sort((a, b) => b.v - a.v);
  const label = (m: string) => format(parseISO(`${m}-01`), "LLLL", { locale: cs });
  const total = vals.reduce((s, x) => s + x.v, 0) / vals.length;
  return (
    <p className="text-xs text-muted">
      Nejvíc: <strong className="text-ink">{label(sorted[0].m)}</strong> ({formatNumber(sorted[0].v)} %), {label(sorted[1].m)} ({formatNumber(sorted[1].v)} %). Nejméně:{" "}
      <strong className="text-ink">{label(sorted[sorted.length - 1].m)}</strong> ({formatNumber(sorted[sorted.length - 1].v)} %). Průměr za rok {formatNumber(Math.round(total * 10) / 10)} %.
    </p>
  );
}

/** Po odděleních: jména seřazená tak, aby nahoře byli lidé, kteří loni hlavní období neměli. */
function FairRota({ data, periodKey }: { data: Data; periodKey: string }) {
  const period = MAIN_PERIODS.find((p) => p.key === periodKey) ?? MAIN_PERIODS[0];
  // sezóna: pokud už jsme po jejím konci, ukazujeme příští
  const now = new Date();
  let year = now.getFullYear();
  if (format(now, "yyyy-MM-dd") > periodWindow(period, year).to) year += 1;
  const rota = fairRota(data.rotaPeople, data.rotaRequests, period, year, data.workDays);
  const window = periodWindow(period, year);
  const entries = Array.from(rota.entries()).filter(([, rows]) => rows.length > 0);
  if (entries.length === 0) return <p className="text-muted">Žádná data.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Sezóna {format(parseISO(window.from), "d. M. yyyy", { locale: cs })} – {format(parseISO(window.to), "d. M. yyyy", { locale: cs })}
      </p>
      {entries.map(([deptId, rows]) => (
        <div key={deptId ?? "none"}>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{deptId ? data.deptNames.get(deptId) ?? "Oddělení" : "Bez oddělení"}</div>
          <div className="space-y-1">
            {rows.slice(0, 8).map((r) => {
              const priority = r.lastSeason === 0 && r.thisSeason === 0;
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className={cn("min-w-0 truncate", priority && "font-medium")}>{r.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    loni {formatNumber(r.lastSeason)} · letos {formatNumber(r.thisSeason)}
                    {priority && <span className="ml-1.5 rounded-sm bg-teal-light px-1.5 py-0.5 text-teal-dark">bez loňska</span>}
                  </span>
                </div>
              );
            })}
            {rows.length > 8 && <div className="text-xs text-muted">a dalších {rows.length - 8}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
