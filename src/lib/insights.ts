// HR Insights — čisté výpočty nad načtenými daty (žádný přístup k databázi), aby šly použít v prohlížeči i v serverové
// týdenní kontrole a snadno testovat. Zásady: agregace místo jmen u citlivých údajů (nemoc se nikdy nevypisuje
// po jednotlivcích, skupiny menší než MIN_GROUP se neukazují), každý postřeh vychází z dat, která jdou dohledat.
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { DEFAULT_WORK_DAYS, countWorkingDays, czechHolidayName, daysWithin } from "@/lib/working-days";

/** Nejmenší skupina, pro kterou se ukazuje souhrn o nemoci (menší skupiny by šly zpětně přiřadit konkrétním lidem). */
export const MIN_GROUP = 5;

export interface InPerson {
  id: string;
  department_id: string | null;
}
export interface InDept {
  id: string;
  name: string;
  capacity_warning_percent: number | null;
}
export interface InRequest {
  profile_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status?: string;
  leave_type: { key: string; counts_against?: string; counts_as_present?: boolean } | null;
}

const reduces = (r: InRequest) => !r.leave_type?.counts_as_present && r.leave_type?.key !== "home_office";

// ------------------------------------------------------------------------------------------ nemocnost (anonymně)
export interface SickShare {
  dept: string;
  size: number;
  sickDays: number;
  /** Podíl pracovních dnů stráveného nemocí, v %. */
  sharePct: number;
}

/**
 * Souhrn nemocnosti po odděleních za období. Vrací jen oddělení s alespoň MIN_GROUP lidmi; ostatní se počítají
 * do `hiddenDepartments` (nezobrazují se, aby nešlo poznat konkrétního člověka). Jména se nikdy nevracejí.
 */
export function sickShareByDepartment(
  people: InPerson[],
  depts: { id: string; name: string }[],
  requests: InRequest[],
  from: string,
  to: string,
  workDays: number[] = DEFAULT_WORK_DAYS
): { rows: SickShare[]; company: { size: number; sharePct: number } | null; hiddenDepartments: number } {
  const periodDays = countWorkingDays(from, to, workDays);
  const sick = requests.filter((r) => r.leave_type?.counts_against === "sick");
  const sickByPerson = new Map<string, number>();
  for (const r of sick) sickByPerson.set(r.profile_id, (sickByPerson.get(r.profile_id) ?? 0) + daysWithin(r, from, to, workDays));

  const rows: SickShare[] = [];
  let hidden = 0;
  for (const d of depts) {
    const members = people.filter((p) => p.department_id === d.id);
    if (members.length === 0) continue;
    if (members.length < MIN_GROUP) {
      hidden++;
      continue;
    }
    const days = members.reduce((s, p) => s + (sickByPerson.get(p.id) ?? 0), 0);
    rows.push({ dept: d.name, size: members.length, sickDays: Math.round(days * 10) / 10, sharePct: periodDays > 0 ? Math.round((days / (members.length * periodDays)) * 1000) / 10 : 0 });
  }
  rows.sort((a, b) => b.sharePct - a.sharePct);

  let company: { size: number; sharePct: number } | null = null;
  if (people.length >= MIN_GROUP && periodDays > 0) {
    const total = people.reduce((s, p) => s + (sickByPerson.get(p.id) ?? 0), 0);
    company = { size: people.length, sharePct: Math.round((total / (people.length * periodDays)) * 1000) / 10 };
  }
  return { rows, company, hiddenDepartments: hidden };
}

// ------------------------------------------------------------------------------------------ předpověď kapacity
export interface HeatCell {
  weekStart: string;
  /** Nejvyšší podíl nepřítomných v oddělení v některém pracovním dni týdne, v %. */
  peakPct: number;
  peakCount: number;
  /** Byl by překročen limit oddělení (nebo firmy)? */
  breach: boolean;
  /** Podíl navíc kvůli čekajícím žádostem. */
  pendingPct: number;
}
export interface HeatRow {
  deptId: string;
  dept: string;
  size: number;
  weeks: HeatCell[];
}

/** Kapacita oddělení na dalších `weeks` týdnů. Počítají se schválené absence; čekající se přidávají zvlášť (pendingPct). */
export function capacityHeatmap(opts: {
  people: InPerson[];
  depts: InDept[];
  requests: InRequest[];
  from: string; // ISO, pondělí prvního týdne se dopočítá
  weeks: number;
  companyThresholdPct: number;
  workDays?: number[];
}): HeatRow[] {
  const { people, depts, requests, weeks, companyThresholdPct } = opts;
  const workDays = opts.workDays ?? DEFAULT_WORK_DAYS;
  const monday = startOfWeek(parseISO(opts.from), { weekStartsOn: 1 });
  const deptOf = new Map(people.map((p) => [p.id, p.department_id]));
  const active = requests.filter(reduces);
  const rows: HeatRow[] = [];

  for (const d of depts) {
    const size = people.filter((p) => p.department_id === d.id).length;
    if (size < 2) continue;
    const threshold = d.capacity_warning_percent ?? companyThresholdPct;
    const cells: HeatCell[] = [];
    for (let w = 0; w < weeks; w++) {
      const weekStart = addDays(monday, w * 7);
      let peakApproved = 0;
      let peakAll = 0;
      for (let i = 0; i < 5; i++) {
        const day = addDays(weekStart, i);
        const iso = format(day, "yyyy-MM-dd");
        if (countWorkingDays(iso, iso, workDays) === 0) continue;
        const absent = new Set<string>();
        const absentAll = new Set<string>();
        for (const r of active) {
          if (deptOf.get(r.profile_id) !== d.id || r.start_date > iso || r.end_date < iso) continue;
          absentAll.add(r.profile_id);
          if (r.status !== "pending") absent.add(r.profile_id);
        }
        peakApproved = Math.max(peakApproved, absent.size);
        peakAll = Math.max(peakAll, absentAll.size);
      }
      const pct = Math.round((peakApproved / size) * 100);
      cells.push({
        weekStart: format(weekStart, "yyyy-MM-dd"),
        peakPct: pct,
        peakCount: peakApproved,
        breach: pct >= threshold,
        pendingPct: Math.max(0, Math.round((peakAll / size) * 100) - pct),
      });
    }
    rows.push({ deptId: d.id, dept: d.name, size, weeks: cells });
  }
  return rows.sort((a, b) => a.dept.localeCompare(b.dept, "cs"));
}

// ------------------------------------------------------------------------------------------ rychlost schvalování
export interface Decision {
  actor_id: string | null;
  entity_id: string;
  action: string; // request.approved | request.rejected
  created_at: string;
}
export interface ApprovalSpeedRow {
  actorId: string;
  decisions: number;
  medianHours: number;
  rejectedPct: number;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Jak dlouho žádost čekala na rozhodnutí (od podání do schválení / zamítnutí) — medián v hodinách po schvalovatelích.
 * Rozhodnutí bez známého podání (smazaná žádost) se přeskočí. Schvalovatelé s méně než `minDecisions` rozhodnutími se vynechají.
 */
export function approvalSpeed(decisions: Decision[], submittedAt: Map<string, string>, minDecisions = 3): { rows: ApprovalSpeedRow[]; overallMedianHours: number } {
  const byActor = new Map<string, { hours: number[]; rejected: number }>();
  const all: number[] = [];
  for (const d of decisions) {
    const start = submittedAt.get(d.entity_id);
    if (!start || !d.actor_id) continue;
    const hours = (new Date(d.created_at).getTime() - new Date(start).getTime()) / 3600000;
    if (hours < 0) continue;
    const cur = byActor.get(d.actor_id) ?? { hours: [], rejected: 0 };
    cur.hours.push(hours);
    if (d.action === "request.rejected") cur.rejected++;
    byActor.set(d.actor_id, cur);
    all.push(hours);
  }
  const rows = Array.from(byActor.entries())
    .filter(([, v]) => v.hours.length >= minDecisions)
    .map(([actorId, v]) => ({
      actorId,
      decisions: v.hours.length,
      medianHours: Math.round(median(v.hours) * 10) / 10,
      rejectedPct: Math.round((v.rejected / v.hours.length) * 100),
    }))
    .sort((a, b) => b.medianHours - a.medianHours);
  return { rows, overallMedianHours: Math.round(median(all) * 10) / 10 };
}

// ------------------------------------------------------------------------------------------ závazek z dovolené
export interface Liability {
  totalDays: number;
  forfeitDays: number;
  /** Nevyčerpané dny × průměrné denní náklady (jen když je sazba zadána). */
  amount: number | null;
  forfeitAmount: number | null;
}

/** `remaining` = nevyčerpané dny po lidech; `maxCarryover` = strop převodu (null = bez omezení). Dny nad strop propadnou. */
export function vacationLiability(remaining: number[], maxCarryover: number | null, dailyCost: number | null): Liability {
  const positive = remaining.filter((d) => d > 0);
  const totalDays = positive.reduce((s, d) => s + d, 0);
  const forfeitDays = maxCarryover === null ? 0 : positive.reduce((s, d) => s + Math.max(0, d - maxCarryover), 0);
  return {
    totalDays: Math.round(totalDays * 10) / 10,
    forfeitDays: Math.round(forfeitDays * 10) / 10,
    amount: dailyCost && dailyCost > 0 ? Math.round(totalDays * dailyCost) : null,
    forfeitAmount: dailyCost && dailyCost > 0 ? Math.round(forfeitDays * dailyCost) : null,
  };
}

// ------------------------------------------------------------------------------------------ návrhy dovolené (můstky)
export interface BridgeSuggestion {
  /** Pracovní dny, které si stačí vzít. */
  take: string[];
  /** Celé souvislé volno (od–do) včetně víkendů a svátků. */
  offStart: string;
  offEnd: string;
  offDays: number;
  /** Co volno „vytváří“: název svátku uvnitř, pokud nějaký je. */
  holiday: string | null;
}

/**
 * Najde termíny, kdy stačí 1–2 dny dovolené k souvislému volnu alespoň 4 dny (svátky a víkendy se neodečítají).
 * `workDays` = pracovní týden firmy (ISO 1–7). Výsledek řazený podle poměru volno / vzatá dovolená.
 */
export function bridgeSuggestions(fromISO: string, horizonDays: number, workDays: number[] = DEFAULT_WORK_DAYS, maxTake = 2): BridgeSuggestion[] {
  const start = parseISO(fromISO);
  const days = Array.from({ length: horizonDays + 14 }, (_, i) => addDays(start, i));
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const isOff = (d: Date) => countWorkingDays(iso(d), iso(d), workDays) === 0;
  const out: BridgeSuggestion[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < days.length - 1; i++) {
    if (isOff(days[i])) continue;
    if (!isOff(days[i - 1])) continue;
    // souvislá řada pracovních dnů délky 1..maxTake, za kterou následuje volno
    for (let len = 1; len <= maxTake; len++) {
      const end = i + len - 1;
      if (end + 1 >= days.length) break;
      if (days.slice(i, end + 1).some(isOff)) break;
      if (!isOff(days[end + 1])) continue;
      // rozšíření o volno před a za
      let a = i - 1;
      while (a > 0 && isOff(days[a - 1])) a--;
      let b = end + 1;
      while (b + 1 < days.length && isOff(days[b + 1])) b++;
      const offDays = b - a + 1;
      if (offDays < 4 || iso(days[i]) < fromISO || iso(days[i]) > iso(addDays(start, horizonDays))) continue;
      const key = `${iso(days[a])}-${iso(days[b])}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let holiday: string | null = null;
      for (let k = a; k <= b; k++) holiday = holiday ?? czechHolidayName(days[k]);
      out.push({ take: days.slice(i, end + 1).map(iso), offStart: iso(days[a]), offEnd: iso(days[b]), offDays, holiday });
      break;
    }
  }
  return out.sort((x, y) => y.offDays / y.take.length - x.offDays / x.take.length || x.offStart.localeCompare(y.offStart));
}

// ------------------------------------------------------------------------------------------ týdenní přehled pro HR
export interface DigestInput {
  capacityBreaches: { dept: string; weekStart: string; pct: number; count: number; size: number }[];
  liability: Liability;
  slowPending: number;
  pendingTotal: number;
  medianDecisionHours: number;
}

/** Text týdenního přehledu pro HR a adminy (e-mail). Vrací null, když není nic k řešení a nemá smysl obtěžovat. */
export function hrDigest(input: DigestInput): { subject: string; body: string } | null {
  const lines: string[] = [];
  if (input.capacityBreaches.length > 0) {
    lines.push("Riziko podkapacity v nejbližších týdnech:");
    for (const c of input.capacityBreaches.slice(0, 5)) lines.push(`• ${c.dept} — týden od ${format(parseISO(c.weekStart), "d. M.")}: chybí ${c.count} z ${c.size} (${c.pct} %)`);
  }
  if (input.slowPending > 0) lines.push(`Žádosti čekající déle než obvykle: ${input.slowPending} z ${input.pendingTotal}.`);
  if (input.liability.forfeitDays > 0) {
    lines.push(`Dovolená, která propadne při převodu do dalšího roku: ${input.liability.forfeitDays} dní${input.liability.forfeitAmount !== null ? ` (asi ${input.liability.forfeitAmount.toLocaleString("cs-CZ")} Kč)` : ""}.`);
  }
  if (lines.length === 0) return null;
  const header = `Dobré ráno,\n\nzde je týdenní přehled pro HR${input.medianDecisionHours > 0 ? ` (medián rozhodování o žádostech: ${input.medianDecisionHours} h)` : ""}.`;
  return { subject: "Týdenní přehled pro HR — Dodio", body: `${header}\n\n${lines.join("\n")}` };
}

// ------------------------------------------------------------------------------------------ trendy po měsících
export interface MonthPoint {
  month: string; // yyyy-MM
  absencePct: number;
  vacationPct: number;
  homeOfficePct: number;
  /** Nemocnost jen souhrnně za celou firmu; null, když je lidí méně než MIN_GROUP. */
  sickPct: number | null;
}

const monthBounds = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Měsíční trendy za posledních `months` měsíců (včetně `endMonth`). Podíly jsou v % pracovních dnů všech (dnes aktivních) lidí.
 * Absence přes hranici měsíce se dělí (daysWithin). Rozdělení lidí v minulosti neznáme, proto se počítá se současným stavem.
 */
export function monthlyTrend(peopleCount: number, requests: InRequest[], endMonth: string, months = 12, workDays: number[] = DEFAULT_WORK_DAYS): MonthPoint[] {
  const out: MonthPoint[] = [];
  const approved = requests.filter((r) => r.status !== "pending");
  for (let i = months - 1; i >= 0; i--) {
    const month = shiftMonth(endMonth, -i);
    const { from, to } = monthBounds(month);
    const period = countWorkingDays(from, to, workDays);
    const denom = peopleCount * period;
    let absence = 0;
    let vacation = 0;
    let ho = 0;
    let sick = 0;
    for (const r of approved) {
      if (r.end_date < from || r.start_date > to) continue;
      const d = daysWithin(r, from, to, workDays);
      if (reduces(r)) absence += d;
      if (r.leave_type?.counts_against === "vacation") vacation += d;
      if (r.leave_type?.key === "home_office") ho += d;
      if (r.leave_type?.counts_against === "sick") sick += d;
    }
    const pct = (x: number) => (denom > 0 ? Math.round((x / denom) * 1000) / 10 : 0);
    out.push({ month, absencePct: pct(absence), vacationPct: pct(vacation), homeOfficePct: pct(ho), sickPct: peopleCount >= MIN_GROUP ? pct(sick) : null });
  }
  return out;
}

// ------------------------------------------------------------------------------------------ hlavní období (férovost)
export interface MainPeriod {
  key: string;
  label: string;
  from: string; // MM-DD
  to: string; // MM-DD (může být v následujícím roce)
}

export const MAIN_PERIODS: MainPeriod[] = [
  { key: "xmas", label: "Vánoce", from: "12-22", to: "01-02" },
  { key: "summer", label: "Léto", from: "07-01", to: "08-31" },
];

/** Konkrétní okno období pro sezónu začínající v roce `year` (Vánoce 2026 = 22. 12. 2026 – 2. 1. 2027). */
export function periodWindow(p: MainPeriod, year: number): { from: string; to: string } {
  const crosses = p.to < p.from;
  return { from: `${year}-${p.from}`, to: `${crosses ? year + 1 : year}-${p.to}` };
}

/** Do kterého hlavního období (a které sezóny) žádost spadá; null, když do žádného. */
export function mainPeriodOf(r: { start_date: string; end_date: string }): { period: MainPeriod; year: number } | null {
  const y = Number(r.start_date.slice(0, 4));
  for (const p of MAIN_PERIODS) {
    for (const year of [y - 1, y]) {
      const w = periodWindow(p, year);
      if (r.start_date <= w.to && r.end_date >= w.from) return { period: p, year };
    }
  }
  return null;
}

export interface RotaPerson {
  id: string;
  name: string;
  department_id: string | null;
}
export interface RotaRow {
  id: string;
  name: string;
  /** Dny dovolené v tomtéž období minulé sezóny. */
  lastSeason: number;
  /** Už naplánované (schválené i čekající) dny v aktuální sezóně. */
  thisSeason: number;
}

/** Kdo měl loni hlavní období a kdo letos už něco plánuje — podklad pro férové schvalování. Jen dovolená (žádné citlivé typy). */
export function fairRota(people: RotaPerson[], requests: InRequest[], period: MainPeriod, year: number, workDays: number[] = DEFAULT_WORK_DAYS): Map<string | null, RotaRow[]> {
  const cur = periodWindow(period, year);
  const prev = periodWindow(period, year - 1);
  const vac = requests.filter((r) => r.leave_type?.counts_against === "vacation");
  const byDept = new Map<string | null, RotaRow[]>();
  for (const p of people) {
    const mine = vac.filter((r) => r.profile_id === p.id);
    const row: RotaRow = {
      id: p.id,
      name: p.name,
      lastSeason: Math.round(mine.filter((r) => r.status !== "pending").reduce((s, r) => s + daysWithin(r, prev.from, prev.to, workDays), 0) * 10) / 10,
      thisSeason: Math.round(mine.reduce((s, r) => s + daysWithin(r, cur.from, cur.to, workDays), 0) * 10) / 10,
    };
    byDept.set(p.department_id, [...(byDept.get(p.department_id) ?? []), row]);
  }
  for (const rows of byDept.values()) rows.sort((a, b) => a.lastSeason - b.lastSeason || a.thisSeason - b.thisSeason || a.name.localeCompare(b.name, "cs"));
  return byDept;
}

/** Krátká poznámka pro schvalovatele: měl(a) žadatel(ka) loni totéž období? null, když žádost není v hlavním období. */
export function fairnessHint(request: { start_date: string; end_date: string }, personRequests: InRequest[], workDays: number[] = DEFAULT_WORK_DAYS): string | null {
  const hit = mainPeriodOf(request);
  if (!hit) return null;
  const prev = periodWindow(hit.period, hit.year - 1);
  const days = personRequests
    .filter((r) => r.leave_type?.counts_against === "vacation" && r.status !== "pending")
    .reduce((s, r) => s + daysWithin(r, prev.from, prev.to, workDays), 0);
  const label = hit.period.label;
  return days > 0 ? `${label}: loni měl(a) ${Math.round(days * 10) / 10} ${days === 1 ? "den" : days < 5 ? "dny" : "dní"} dovolené` : `${label}: loni tohle období neměl(a)`;
}

// ------------------------------------------------------------------------------------------ dobití baterií
export interface RechargeScore {
  dept: string;
  size: number;
  /** Podíl lidí, kteří za posledních ~6 měsíců měli souvislou dovolenou aspoň `minDays` pracovních dní. */
  pct: number;
}

/**
 * Skóre „dobití baterií“ po odděleních (jen skupiny ≥ MIN_GROUP) a za firmu — bez jmen. Souvislý blok = jedna schválená žádost
 * o dovolenou s aspoň `minDays` pracovními dny, která skončila v posledních `windowDays` dnech nebo právě probíhá.
 */
export function rechargeScore(
  people: InPerson[],
  depts: { id: string; name: string }[],
  requests: InRequest[],
  today: string,
  windowDays = 182,
  minDays = 5
): { rows: RechargeScore[]; company: { size: number; pct: number } | null; hiddenDepartments: number } {
  const since = format(addDays(parseISO(today), -windowDays), "yyyy-MM-dd");
  const recharged = new Set(
    requests
      .filter((r) => r.leave_type?.counts_against === "vacation" && r.status !== "pending" && Number(r.working_days) >= minDays && r.end_date >= since && r.start_date <= today)
      .map((r) => r.profile_id)
  );
  const rows: RechargeScore[] = [];
  let hidden = 0;
  for (const d of depts) {
    const members = people.filter((p) => p.department_id === d.id);
    if (members.length === 0) continue;
    if (members.length < MIN_GROUP) {
      hidden++;
      continue;
    }
    rows.push({ dept: d.name, size: members.length, pct: Math.round((members.filter((m) => recharged.has(m.id)).length / members.length) * 100) });
  }
  rows.sort((a, b) => a.pct - b.pct);
  const company = people.length >= MIN_GROUP ? { size: people.length, pct: Math.round((people.filter((p) => recharged.has(p.id)).length / people.length) * 100) } : null;
  return { rows, company, hiddenDepartments: hidden };
}
