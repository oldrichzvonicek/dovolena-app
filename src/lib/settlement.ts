import { DEFAULT_WORK_DAYS, daysWithin } from "@/lib/working-days";

/**
 * Vyrovnání dovolené při ukončení pracovního poměru: kolik dní dovolené zaměstnanci k datu odchodu poměrně náleží,
 * kolik vyčerpal a kolik zbývá (kladné = nevyčerpáno, řeší se náhradou mzdy nebo vybráním, záporné = přečerpáno).
 * Výpočet je ORIENTAČNÍ podklad pro mzdovou účetní — částku (průměrný výdělek) Dodio nezná.
 *
 * Pravidlo: roční nárok se krátí na počet měsíců trvání pracovního poměru v roce (měsíc nástupu i měsíc ukončení
 * se počítají celé, stejně jako u poměrné dovolené nováčků) a zaokrouhluje se NAHORU na půl dne.
 */

/** Zaokrouhlení nahoru na půl dne (bez chyb desetinných čísel). */
export function ceilHalf(n: number): number {
  return Math.ceil(Math.round(n * 2 * 1e6) / 1e6) / 2;
}

export interface SettlementInput {
  /** Roční nárok na dovolenou pro rok ukončení. */
  total: number;
  /** Převod z minulého roku, který je k dispozici. */
  carryover: number;
  /** Dny čerpané před zavedením Dodia. */
  openingUsed: number;
  /** Schválené absence typu dovolená. */
  requests: { start_date: string; end_date: string; working_days: number }[];
  /** Datum ukončení pracovního poměru (yyyy-mm-dd). */
  termination: string;
  /** Datum nástupu (yyyy-mm-dd), pokud je v roce ukončení. */
  hire?: string | null;
  workDays?: number[];
}

export interface Settlement {
  year: number;
  /** Kolik měsíců v roce trval pracovní poměr (1–12). */
  months: number;
  /** Poměrný roční nárok. */
  prorated: number;
  carryover: number;
  /** Nárok celkem k datu odchodu (poměrný + převod). */
  entitled: number;
  /** Vyčerpáno do data odchodu (včetně čerpání před Dodiem). */
  used: number;
  /** Naplánováno po datu odchodu — zaměstnanec je nevyčerpá, je třeba je zrušit. */
  plannedAfter: number;
  /** Kladné = nevyčerpáno, záporné = přečerpáno. */
  balance: number;
}

export function settleVacation(i: SettlementInput): Settlement {
  const year = Number(i.termination.slice(0, 4));
  const endMonth = Number(i.termination.slice(5, 7));
  const hiredThisYear = !!i.hire && Number(i.hire.slice(0, 4)) === year;
  const startMonth = hiredThisYear ? Number(i.hire!.slice(5, 7)) : 1;
  const months = Math.max(0, Math.min(12, endMonth - startMonth + 1));
  const prorated = months >= 12 ? i.total : Math.min(i.total, ceilHalf((i.total * months) / 12));
  const workDays = i.workDays ?? DEFAULT_WORK_DAYS;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const usedInApp = i.requests.reduce((s, r) => s + daysWithin(r, yearStart, i.termination, workDays), 0);
  const after = i.requests.reduce((s, r) => s + (i.termination < yearEnd ? daysWithin(r, nextDay(i.termination), yearEnd, workDays) : 0), 0);

  const entitled = prorated + i.carryover;
  const used = i.openingUsed + usedInApp;
  return { year, months, prorated, carryover: i.carryover, entitled, used, plannedAfter: after, balance: Math.round((entitled - used) * 10) / 10 };
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
