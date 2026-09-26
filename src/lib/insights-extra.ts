// Smart HR Insights — další postřehy nad daty, která v aplikaci už jsou. Stejné zásady jako v insights.ts: čisté funkce bez
// přístupu k databázi, nemoc jen souhrnně (nikdy po jménech, jen pro skupiny od MIN_GROUP lidí), každý postřeh jde dohledat.
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { MIN_GROUP } from "@/lib/insights";
import { DEFAULT_WORK_DAYS, czechHolidayName, daysWithin } from "@/lib/working-days";

export interface XRequest {
  profile_id: string;
  start_date: string;
  end_date: string;
  half_day?: boolean | null;
  working_days: number;
  status: string;
  created_at: string;
  approved_by?: string | null;
  leave_type: { key: string; counts_against?: string; counts_as_present?: boolean } | null;
}
export interface XPerson {
  id: string;
  name: string;
  department_id: string | null;
  substitute_id: string | null;
  active: boolean;
  created_at: string;
  deactivated_at: string | null;
}
export interface XDept {
  id: string;
  name: string;
  head_profile_id: string | null;
  deputy_head_profile_id: string | null;
}

/** Závažnost 3 = řešit hned, 2 = pozor, 1 = k zamyšlení. */
export interface Finding {
  severity: 1 | 2 | 3;
  card: string;
  text: string;
}

const isVacation = (r: XRequest) => r.leave_type?.counts_against === "vacation";
const isSick = (r: XRequest) => r.leave_type?.counts_against === "sick";
const isHomeOffice = (r: XRequest) => r.leave_type?.key === "home_office";
/** Absence, při které člověk chybí (ne Home Office a jiné typy, kdy se pracuje). */
const isAway = (r: XRequest) => !r.leave_type?.counts_as_present && !isHomeOffice(r);
const live = (r: XRequest) => r.status === "approved" || r.status === "pending";

const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;
const isWorkingDay = (d: Date, workDays: number[]) => workDays.includes(isoWeekday(d)) && !czechHolidayName(d);

/** Projde pracovní dny žádosti (včetně počtu, ať se dá agregovat). */
function eachWorkingDay(r: { start_date: string; end_date: string }, workDays: number[], fn: (d: Date) => void, from?: string, to?: string) {
  const start = parseISO(r.start_date > (from ?? "") ? r.start_date : from ?? r.start_date);
  const end = parseISO(to && r.end_date > to ? to : r.end_date);
  for (let d = start; d <= end; d = addDays(d, 1)) if (isWorkingDay(d, workDays)) fn(d);
}

// ------------------------------------------------------------------------------------------ 1) hokejka dovolené
export interface VacationCurve {
  /** Dny dovolené (schválené i čekající) po měsících letošního roku. */
  months: { month: number; days: number; future: boolean }[];
  /** Lidé, kterým zbývá dovolená, kterou ještě nemají naplánovanou. */
  unplanned: { id: string; days: number }[];
  totalUnplanned: number;
  weeksLeft: number;
  perWeek: number;
}

export function vacationCurve(requests: XRequest[], today: string, workDays: number[], remaining: Map<string, number>): VacationCurve {
  const year = Number(today.slice(0, 4));
  const months = Array.from({ length: 12 }, (_, i) => {
    const from = `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const to = format(new Date(year, i + 1, 0), "yyyy-MM-dd");
    const days = requests.filter((r) => isVacation(r) && live(r)).reduce((s, r) => s + daysWithin(r, from, to, workDays), 0);
    return { month: i + 1, days: Math.round(days * 10) / 10, future: to > today };
  });
  const pendingFuture = new Map<string, number>();
  for (const r of requests) if (isVacation(r) && r.status === "pending" && r.end_date >= today) pendingFuture.set(r.profile_id, (pendingFuture.get(r.profile_id) ?? 0) + Number(r.working_days));
  const unplanned: VacationCurve["unplanned"] = [];
  for (const [id, rem] of remaining) {
    const days = rem - (pendingFuture.get(id) ?? 0);
    if (days >= 1) unplanned.push({ id, days: Math.round(days * 10) / 10 });
  }
  unplanned.sort((a, b) => b.days - a.days);
  const totalUnplanned = Math.round(unplanned.reduce((s, u) => s + u.days, 0) * 10) / 10;
  const weeksLeft = Math.max(0, Math.ceil(differenceInCalendarDays(parseISO(`${year}-12-31`), parseISO(today)) / 7));
  return { months, unplanned, totalUnplanned, weeksLeft, perWeek: weeksLeft > 0 ? Math.round((totalUnplanned / weeksLeft) * 10) / 10 : totalUnplanned };
}

// ------------------------------------------------------------------------------------------ 2) mosty a víkendy
export interface BridgeShare {
  total: number;
  adjoining: number;
  pct: number;
  /** Dny dovolené podle dne v týdnu (1 = pondělí … 7 = neděle). */
  byWeekday: { weekday: number; days: number }[];
}

export function bridgeShare(requests: XRequest[], today: string, workDays: number[]): BridgeShare {
  const since = iso(addDays(parseISO(today), -365));
  const vac = requests.filter((r) => isVacation(r) && live(r) && r.start_date >= since && !r.half_day);
  let adjoining = 0;
  const byDay = new Map<number, number>();
  for (const r of vac) {
    const before = addDays(parseISO(r.start_date), -1);
    const after = addDays(parseISO(r.end_date), 1);
    if (!isWorkingDay(before, workDays) || !isWorkingDay(after, workDays)) adjoining++;
    eachWorkingDay(r, workDays, (d) => byDay.set(isoWeekday(d), (byDay.get(isoWeekday(d)) ?? 0) + 1));
  }
  return { total: vac.length, adjoining, pct: pct(adjoining, vac.length), byWeekday: workDays.map((w) => ({ weekday: w, days: byDay.get(w) ?? 0 })) };
}

// ------------------------------------------------------------------------------------------ 3) zástupy
export interface SubstituteRisk {
  noSubstitute: string[];
  /** Zástupci, kteří zastupují víc kolegů najednou. */
  overloaded: { id: string; covers: string[] }[];
  /** Termíny, kdy chybí člověk i jeho zástup. */
  clashes: { personId: string; substituteId: string; from: string; to: string }[];
}

/** Sjednotí absence člověka do intervalů (jen pobyty, které zasahují do okna). */
function awayWindows(requests: XRequest[], profileId: string, from: string, to: string) {
  return requests.filter((r) => r.profile_id === profileId && isAway(r) && live(r) && r.end_date >= from && r.start_date <= to).map((r) => ({ from: r.start_date, to: r.end_date }));
}

export function substituteRisk(people: XPerson[], requests: XRequest[], today: string, horizonDays = 60): SubstituteRisk {
  const to = iso(addDays(parseISO(today), horizonDays));
  const active = people.filter((p) => p.active);
  const byId = new Map(active.map((p) => [p.id, p]));
  const noSubstitute = active.filter((p) => !p.substitute_id).map((p) => p.id);
  const covers = new Map<string, string[]>();
  for (const p of active) if (p.substitute_id && byId.has(p.substitute_id)) covers.set(p.substitute_id, [...(covers.get(p.substitute_id) ?? []), p.id]);
  const overloaded = Array.from(covers, ([id, list]) => ({ id, covers: list })).filter((x) => x.covers.length >= 3).sort((a, b) => b.covers.length - a.covers.length);
  const clashes: SubstituteRisk["clashes"] = [];
  for (const p of active) {
    if (!p.substitute_id || !byId.has(p.substitute_id)) continue;
    const mine = awayWindows(requests, p.id, today, to);
    const theirs = awayWindows(requests, p.substitute_id, today, to);
    for (const a of mine)
      for (const b of theirs) {
        const f = a.from > b.from ? a.from : b.from;
        const t = a.to < b.to ? a.to : b.to;
        if (f <= t && f >= today) clashes.push({ personId: p.id, substituteId: p.substitute_id, from: f, to: t });
      }
  }
  clashes.sort((a, b) => a.from.localeCompare(b.from));
  return { noSubstitute, overloaded, clashes };
}

// ------------------------------------------------------------------------------------------ 4) předstih žádostí
export interface LeadTimeRow {
  dept: string;
  requests: number;
  medianDays: number;
  shortPct: number;
}
export interface LeadTime {
  overall: { requests: number; medianDays: number; shortPct: number };
  rows: LeadTimeRow[];
}
const SHORT_NOTICE_DAYS = 3;

export function leadTime(requests: XRequest[], people: XPerson[], depts: { id: string; name: string }[], today: string): LeadTime {
  const since = iso(addDays(parseISO(today), -365));
  const lead = (r: XRequest) => Math.max(0, differenceInCalendarDays(parseISO(r.start_date), parseISO(r.created_at.slice(0, 10))));
  const vac = requests.filter((r) => isVacation(r) && r.created_at.slice(0, 10) >= since);
  const summary = (list: XRequest[]) => {
    const leads = list.map(lead);
    return { requests: list.length, medianDays: Math.round(median(leads)), shortPct: pct(leads.filter((l) => l <= SHORT_NOTICE_DAYS).length, leads.length) };
  };
  const rows: LeadTimeRow[] = [];
  for (const d of depts) {
    const members = new Set(people.filter((p) => p.department_id === d.id).map((p) => p.id));
    if (members.size < MIN_GROUP) continue;
    const list = vac.filter((r) => members.has(r.profile_id));
    if (list.length < 5) continue;
    rows.push({ dept: d.name, ...summary(list) });
  }
  rows.sort((a, b) => b.shortPct - a.shortPct);
  return { overall: summary(vac), rows };
}

// ------------------------------------------------------------------------------------------ 5) schvalování a zamítání
export interface DecisionStats {
  overall: { decided: number; rejectedPct: number };
  byDept: { dept: string; decided: number; rejectedPct: number }[];
  byApprover: { approverId: string; decided: number; rejectedPct: number }[];
}

export function decisionStats(requests: XRequest[], people: XPerson[], depts: { id: string; name: string }[], today: string): DecisionStats {
  const since = iso(addDays(parseISO(today), -365));
  const decided = requests.filter((r) => isVacation(r) && (r.status === "approved" || r.status === "rejected") && r.created_at.slice(0, 10) >= since);
  const rejected = (l: XRequest[]) => l.filter((r) => r.status === "rejected").length;
  const byDept: DecisionStats["byDept"] = [];
  for (const d of depts) {
    const members = new Set(people.filter((p) => p.department_id === d.id).map((p) => p.id));
    if (members.size < MIN_GROUP) continue;
    const list = decided.filter((r) => members.has(r.profile_id));
    if (list.length >= 5) byDept.push({ dept: d.name, decided: list.length, rejectedPct: pct(rejected(list), list.length) });
  }
  byDept.sort((a, b) => b.rejectedPct - a.rejectedPct);
  const approvers = new Map<string, XRequest[]>();
  for (const r of decided) if (r.approved_by) approvers.set(r.approved_by, [...(approvers.get(r.approved_by) ?? []), r]);
  const byApprover = Array.from(approvers, ([approverId, list]) => ({ approverId, decided: list.length, rejectedPct: pct(rejected(list), list.length) }))
    .filter((a) => a.decided >= 5)
    .sort((a, b) => b.rejectedPct - a.rejectedPct);
  return { overall: { decided: decided.length, rejectedPct: pct(rejected(decided), decided.length) }, byDept, byApprover };
}

// ------------------------------------------------------------------------------------------ 6) krátké nemoci (jen souhrnně)
export interface SickPattern {
  episodes: number;
  shortEpisodes: number;
  /** Krátké nemoci (do 2 pracovních dnů) podle dne začátku: 1 = pondělí … 5 = pátek. */
  shortByStartWeekday: { weekday: number; count: number }[];
  mondayFridayPct: number;
}

/** Vrací null, když je ve skupině méně než MIN_GROUP lidí (jinak by šlo zpětně poznat jednotlivce). */
export function sickPattern(requests: XRequest[], peopleCount: number, today: string, workDays: number[] = DEFAULT_WORK_DAYS): SickPattern | null {
  if (peopleCount < MIN_GROUP) return null;
  const since = iso(addDays(parseISO(today), -365));
  const sick = requests.filter((r) => isSick(r) && r.status === "approved" && r.start_date >= since && r.start_date <= today);
  const short = sick.filter((r) => Number(r.working_days) <= 2);
  const count = new Map<number, number>();
  for (const r of short) {
    const w = isoWeekday(parseISO(r.start_date));
    count.set(w, (count.get(w) ?? 0) + 1);
  }
  const edge = (count.get(1) ?? 0) + (count.get(5) ?? 0);
  return { episodes: sick.length, shortEpisodes: short.length, shortByStartWeekday: workDays.map((w) => ({ weekday: w, count: count.get(w) ?? 0 })), mondayFridayPct: pct(edge, short.length) };
}

// ------------------------------------------------------------------------------------------ 7) Home Office
export interface HomeOfficeShare {
  /** Podíl pracovních dnů stráveného na Home Office za posledních 90 dní, v %. */
  overallPct: number;
  /** Podíl podle dne v týdnu, v %. */
  byWeekday: { weekday: number; pct: number }[];
  byDept: { dept: string; pct: number }[];
}

export function homeOfficeShare(requests: XRequest[], people: XPerson[], depts: { id: string; name: string }[], today: string, workDays: number[]): HomeOfficeShare | null {
  const active = people.filter((p) => p.active);
  if (active.length < MIN_GROUP) return null;
  const from = iso(addDays(parseISO(today), -90));
  const ho = requests.filter((r) => isHomeOffice(r) && r.status === "approved" && r.end_date >= from && r.start_date <= today);
  // Kolik pracovních dnů (a kterých) v okně je — jmenovatel pro podíly.
  const dayCount = new Map<number, number>();
  for (let d = parseISO(from); iso(d) <= today; d = addDays(d, 1)) if (isWorkingDay(d, workDays)) dayCount.set(isoWeekday(d), (dayCount.get(isoWeekday(d)) ?? 0) + 1);
  const totalDays = Array.from(dayCount.values()).reduce((s, n) => s + n, 0);
  const perWeekday = new Map<number, number>();
  const perPerson = new Map<string, number>();
  for (const r of ho)
    eachWorkingDay(
      r,
      workDays,
      (d) => {
        perWeekday.set(isoWeekday(d), (perWeekday.get(isoWeekday(d)) ?? 0) + 1);
        perPerson.set(r.profile_id, (perPerson.get(r.profile_id) ?? 0) + 1);
      },
      from,
      today
    );
  const overall = Array.from(perPerson.values()).reduce((s, n) => s + n, 0);
  const byDept: HomeOfficeShare["byDept"] = [];
  for (const d of depts) {
    const members = active.filter((p) => p.department_id === d.id);
    if (members.length < MIN_GROUP) continue;
    byDept.push({ dept: d.name, pct: pct(members.reduce((s, m) => s + (perPerson.get(m.id) ?? 0), 0), members.length * totalDays) });
  }
  byDept.sort((a, b) => b.pct - a.pct);
  return {
    overallPct: pct(overall, active.length * totalDays),
    byWeekday: workDays.map((w) => ({ weekday: w, pct: pct(perWeekday.get(w) ?? 0, active.length * (dayCount.get(w) ?? 0)) })),
    byDept,
  };
}

// ------------------------------------------------------------------------------------------ 8) kolize klíčových lidí
export interface KeyPeopleRisk {
  clashes: { dept: string; headId: string; deputyId: string; from: string; to: string }[];
  noDeputy: { dept: string; headId: string }[];
}

export function keyPeopleRisk(depts: XDept[], people: XPerson[], requests: XRequest[], today: string, horizonDays = 90): KeyPeopleRisk {
  const to = iso(addDays(parseISO(today), horizonDays));
  const activeIds = new Set(people.filter((p) => p.active).map((p) => p.id));
  const clashes: KeyPeopleRisk["clashes"] = [];
  const noDeputy: KeyPeopleRisk["noDeputy"] = [];
  for (const d of depts) {
    if (!d.head_profile_id || !activeIds.has(d.head_profile_id)) continue;
    if (!d.deputy_head_profile_id || !activeIds.has(d.deputy_head_profile_id)) {
      noDeputy.push({ dept: d.name, headId: d.head_profile_id });
      continue;
    }
    const a = awayWindows(requests, d.head_profile_id, today, to);
    const b = awayWindows(requests, d.deputy_head_profile_id, today, to);
    for (const x of a)
      for (const y of b) {
        const f = x.from > y.from ? x.from : y.from;
        const t = x.to < y.to ? x.to : y.to;
        if (f <= t && f >= today) clashes.push({ dept: d.name, headId: d.head_profile_id, deputyId: d.deputy_head_profile_id, from: f, to: t });
      }
  }
  clashes.sort((a, b) => a.from.localeCompare(b.from));
  return { clashes, noDeputy };
}

// ------------------------------------------------------------------------------------------ 9) nováčci a odchody
export interface JoinersLeavers {
  joiners: { id: string; days: number | null }[];
  leavers: { id: string; remaining: number; amount: number | null }[];
}

/** `remaining` = zbývající dovolená podle zůstatků. Nováčci: aktivní s účtem do 90 dní; odchody: deaktivovaní za posledních 180 dní. */
export function joinersLeavers(people: XPerson[], remaining: Map<string, number>, today: string, dailyCost: number | null): JoinersLeavers {
  const joinedSince = iso(addDays(parseISO(today), -90));
  const leftSince = iso(addDays(parseISO(today), -180));
  const joiners = people.filter((p) => p.active && p.created_at.slice(0, 10) >= joinedSince).map((p) => ({ id: p.id, days: remaining.has(p.id) ? remaining.get(p.id)! : null }));
  const leavers = people
    .filter((p) => !p.active && p.deactivated_at && p.deactivated_at.slice(0, 10) >= leftSince)
    .map((p) => {
      const rem = remaining.get(p.id) ?? 0;
      return { id: p.id, remaining: Math.round(rem * 10) / 10, amount: dailyCost && rem > 0 ? Math.round(rem * dailyCost) : null };
    })
    .filter((l) => l.remaining !== 0);
  return { joiners, leavers };
}

// ------------------------------------------------------------------------------------------ 10) shrnutí týdne
/** Číslo s desetinnou čárkou. */
export const cz = (n: number) => String(n).replace(".", ",");
export const dayWordCs = (n: number) => (n === 1 ? "den" : n >= 2 && n <= 4 ? "dny" : "dní");

export interface ExtraResults {
  curve: VacationCurve;
  bridge: BridgeShare;
  subs: SubstituteRisk;
  lead: LeadTime;
  decisions: DecisionStats;
  sick: SickPattern | null;
  home: HomeOfficeShare | null;
  key: KeyPeopleRisk;
  moves: JoinersLeavers;
}

/** Nejdůležitější zjištění týdne ze všech karet. Jména se nevypisují (kromě počtů); podrobnosti jsou v kartách. */
export function weeklyFindings(x: ExtraResults, today: string, nameOf: (id: string) => string): Finding[] {
  const out: Finding[] = [];
  const month = Number(today.slice(5, 7));
  if (x.curve.unplanned.length > 0 && month >= 8) {
    out.push({
      severity: month >= 11 ? 3 : 2,
      card: "curve",
      text: `Do konce roku zbývá ${cz(x.curve.totalUnplanned)} ${dayWordCs(Math.round(x.curve.totalUnplanned))} nenaplánované dovolené u ${x.curve.unplanned.length} lidí (asi ${cz(x.curve.perWeek)} dne týdně). Připomeňte jim ji dřív, než se nahrnou na konec roku.`,
    });
  }
  for (const c of x.key.clashes.slice(0, 2)) out.push({ severity: 3, card: "key", text: `V oddělení ${c.dept} chybí ${c.from === c.to ? `dne ${c.from}` : `${c.from} až ${c.to}`} zároveň vedoucí (${nameOf(c.headId)}) i zástupce (${nameOf(c.deputyId)}).` });
  const subClashes = x.subs.clashes.filter((c) => c.from <= iso(addDays(parseISO(today), 30)));
  if (subClashes.length > 0) out.push({ severity: 3, card: "subs", text: `V příštích 30 dnech chybí ${subClashes.length === 1 ? "jeden člověk současně se svým zástupem" : `${subClashes.length} lidí současně se svým zástupem`} (např. ${nameOf(subClashes[0].personId)} a ${nameOf(subClashes[0].substituteId)}).` });
  if (x.subs.noSubstitute.length > 0) out.push({ severity: 1, card: "subs", text: `${x.subs.noSubstitute.length} ${x.subs.noSubstitute.length === 1 ? "člověk nemá" : "lidí nemá"} určený zástup.` });
  if (x.lead.overall.requests >= 10 && x.lead.overall.shortPct >= 30) out.push({ severity: 2, card: "lead", text: `${x.lead.overall.shortPct} % dovolených se žádá s předstihem do ${SHORT_NOTICE_DAYS} dnů. Zkuste připomenout dřívější plánování.` });
  const strict = x.decisions.byDept.find((d) => d.rejectedPct >= 40);
  if (strict) out.push({ severity: 2, card: "decisions", text: `V oddělení ${strict.dept} se zamítá ${strict.rejectedPct} % dovolených (z ${strict.decided} vyřízených). Stojí za to zjistit proč.` });
  if (x.decisions.byApprover.length >= 2) {
    const hi = x.decisions.byApprover[0];
    const lo = x.decisions.byApprover[x.decisions.byApprover.length - 1];
    if (hi.rejectedPct - lo.rejectedPct >= 30) out.push({ severity: 2, card: "decisions", text: `Schvalovatelé zamítají velmi nerovně: ${nameOf(hi.approverId)} ${hi.rejectedPct} %, ${nameOf(lo.approverId)} ${lo.rejectedPct} %. Sjednoťte pravidla.` });
  }
  if (x.sick && x.sick.shortEpisodes >= 8 && x.sick.mondayFridayPct >= 60) out.push({ severity: 1, card: "sick", text: `${x.sick.mondayFridayPct} % krátkých nemocí začíná v pondělí nebo v pátek. Je to souhrn za celou firmu, nic o jednotlivcích. Může jít o zátěž nebo špatné plánování.` });
  if (x.bridge.total >= 10 && x.bridge.pct >= 70) out.push({ severity: 1, card: "bridge", text: `${x.bridge.pct} % dovolených navazuje na víkend nebo svátek, tedy pondělí a pátky bývají nejvíc obsazené.` });
  const owing = x.moves.leavers.filter((l) => l.remaining > 0);
  if (owing.length > 0) {
    const total = Math.round(owing.reduce((s, l) => s + l.remaining, 0) * 10) / 10;
    out.push({ severity: 1, card: "moves", text: `${owing.length === 1 ? "Odešel jeden člověk" : `Odešlo ${owing.length} lidí`} s nevyčerpanou dovolenou (celkem ${cz(total)} ${dayWordCs(Math.round(total))}). Zkontrolujte vyrovnání.` });
  }
  return out.sort((a, b) => b.severity - a.severity);
}
