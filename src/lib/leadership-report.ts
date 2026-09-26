// Report pro vedení: čisté výpočty (bez databáze) pro jednostránkový přehled „čas ušetřený schvalováním“ a
// „riziko propadnutí dovolené“. Čas ušetřený je ODHAD z nastavitelného předpokladu, riziko propadnutí je vypočtené z dat.
import { MIN_GROUP } from "@/lib/insights";

export const DEFAULT_MINUTES_PER_REQUEST = 6;

export interface TimeSaved {
  requests: number;
  minutesPerRequest: number;
  hours: number;
  /** Hodnota ušetřeného času v Kč, když je známá sazba (denní náklady / hodin ve směně). */
  amount: number | null;
}

/** Odhad ušetřeného času: počet vyřízených žádostí × minuty na žádost. Nejde o naměřený údaj. */
export function estimateTimeSaved(requests: number, minutesPerRequest: number, dailyCost: number | null, hoursPerDay: number): TimeSaved {
  const minutes = Math.max(0, minutesPerRequest);
  const hours = Math.round(((requests * minutes) / 60) * 10) / 10;
  const hourly = dailyCost !== null && dailyCost > 0 && hoursPerDay > 0 ? dailyCost / hoursPerDay : null;
  return { requests, minutesPerRequest: minutes, hours, amount: hourly !== null ? Math.round(hours * hourly) : null };
}

export interface ForfeitRisk {
  totalDays: number;
  people: number;
  amount: number | null;
  /** Souhrn po odděleních: jen počty a dny, bez jmen. Oddělení menší než MIN_GROUP se slučují do „Ostatní“. */
  byDept: { dept: string; people: number; days: number }[];
  /** Lidé, kterým zbývá hodně dovolené a mohou k propadnutí dospět (nad prahem, ale ještě pod stropem převodu). */
  atRiskPeople: number;
}

/**
 * Riziko propadnutí: dny nad strop převodu (`maxCarryover`) k 31. 12. propadnou. Bez stropu (null) nic nepropadá, ale
 * `atRiskPeople` pořád ukáže lidi s velkým zůstatkem.
 */
export function forfeitRisk(
  people: { departmentId: string | null; remaining: number }[],
  deptNames: Map<string, string>,
  maxCarryover: number | null,
  dailyCost: number | null,
  warnAbove = 10
): ForfeitRisk {
  const byDept = new Map<string, { people: number; days: number; size: number }>();
  const sizes = new Map<string, number>();
  for (const p of people) sizes.set(p.departmentId ?? "none", (sizes.get(p.departmentId ?? "none") ?? 0) + 1);
  let totalDays = 0;
  let count = 0;
  let atRisk = 0;
  for (const p of people) {
    if (p.remaining > warnAbove) atRisk++;
    const lost = maxCarryover !== null ? Math.max(0, p.remaining - maxCarryover) : 0;
    if (lost <= 0) continue;
    totalDays += lost;
    count++;
    const key = p.departmentId ?? "none";
    const cur = byDept.get(key) ?? { people: 0, days: 0, size: sizes.get(key) ?? 0 };
    cur.people++;
    cur.days += lost;
    byDept.set(key, cur);
  }
  const rows: ForfeitRisk["byDept"] = [];
  let other = { people: 0, days: 0 };
  for (const [key, v] of byDept) {
    // Skupiny pod MIN_GROUP se neukazují samostatně, aby šlo poznat jednotlivce.
    if (v.size < MIN_GROUP) {
      other = { people: other.people + v.people, days: other.days + v.days };
      continue;
    }
    rows.push({ dept: key === "none" ? "Bez oddělení" : deptNames.get(key) ?? "Oddělení", people: v.people, days: Math.round(v.days * 10) / 10 });
  }
  rows.sort((a, b) => b.days - a.days);
  if (other.people > 0) rows.push({ dept: "Ostatní (menší oddělení)", people: other.people, days: Math.round(other.days * 10) / 10 });
  const rounded = Math.round(totalDays * 10) / 10;
  return { totalDays: rounded, people: count, amount: dailyCost !== null && dailyCost > 0 ? Math.round(rounded * dailyCost) : null, byDept: rows, atRiskPeople: atRisk };
}

const cz = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const kc = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;

export interface ReportSummaryInput {
  company: string;
  period: string;
  saved: TimeSaved;
  medianHours: number | null;
  risk: ForfeitRisk;
  collisions: number;
  noSubstitute: number;
}

/** Text do e-mailu vedení (kopíruje se z obrazovky). */
export function reportText(x: ReportSummaryInput): string {
  const lines = [
    `Dodio: přehled pro vedení, ${x.company}, ${x.period}`,
    "",
    `Vyřízeno žádostí: ${x.saved.requests}`,
    `Odhadovaný ušetřený čas: ${cz(x.saved.hours)} h (${x.saved.requests} × ${cz(x.saved.minutesPerRequest)} min na žádost, odhad)${x.saved.amount !== null ? `, v hodnotě asi ${kc(x.saved.amount)}` : ""}`,
    x.medianHours !== null ? `Medián doby schválení: ${cz(x.medianHours)} h` : "",
    "",
    x.risk.totalDays > 0
      ? `Dovolená, která propadne: ${cz(x.risk.totalDays)} dní u ${x.risk.people} lidí${x.risk.amount !== null ? `, asi ${kc(x.risk.amount)}` : ""}.`
      : "Dovolená, která propadne: nic při současných zůstatcích.",
    x.risk.atRiskPeople > 0 ? `Lidí s velkým zůstatkem (nad 10 dní): ${x.risk.atRiskPeople}.` : "",
    x.collisions > 0 ? `Kapacitní kolize v příštích 90 dnech: ${x.collisions}.` : "",
    x.noSubstitute > 0 ? `Lidí bez určeného zástupu: ${x.noSubstitute}.` : "",
  ];
  return lines.filter((l, i) => l !== "" || (i > 0 && lines[i - 1] !== "")).join("\n");
}
