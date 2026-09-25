import { addDays, isWeekend, isSameDay, parseISO, format } from "date-fns";

/**
 * Czech state holidays. Fixed-date holidays only (the Czech calendar has no
 * moving public holidays other than Good Friday and Easter Monday, which are
 * computed below from the Easter algorithm).
 */
function fixedCzechHolidays(year: number): { date: Date; name: string }[] {
  const d = (month: number, day: number) => new Date(year, month - 1, day);
  return [
    { date: d(1, 1), name: "Nový rok / Den obnovy samostatného českého státu" },
    { date: d(5, 1), name: "Svátek práce" },
    { date: d(5, 8), name: "Den vítězství" },
    { date: d(7, 5), name: "Den slovanských věrozvěstů Cyrila a Metoděje" },
    { date: d(7, 6), name: "Den upálení mistra Jana Husa" },
    { date: d(9, 28), name: "Den české státnosti" },
    { date: d(10, 28), name: "Den vzniku samostatného československého státu" },
    { date: d(11, 17), name: "Den boje za svobodu a demokracii" },
    { date: d(12, 24), name: "Štědrý den" },
    { date: d(12, 25), name: "1. svátek vánoční" },
    { date: d(12, 26), name: "2. svátek vánoční" },
  ];
}

/** Anonymous Gregorian algorithm for the date of Easter Sunday. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const dd = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dd - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function namedCzechHolidays(year: number): { date: Date; name: string }[] {
  const easter = easterSunday(year);
  return [
    ...fixedCzechHolidays(year),
    { date: addDays(easter, -2), name: "Velký pátek" },
    { date: addDays(easter, 1), name: "Velikonoční pondělí" },
  ];
}

export function czechHolidays(year: number): Date[] {
  return namedCzechHolidays(year).map((h) => h.date);
}

export function isCzechHoliday(date: Date): boolean {
  return czechHolidays(date.getFullYear()).some((h) => isSameDay(h, date));
}

/** Name of the Czech state holiday on this date, or null if it isn't one. */
export function czechHolidayName(date: Date): string | null {
  return namedCzechHolidays(date.getFullYear()).find((h) => isSameDay(h.date, date))?.name ?? null;
}

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

/** ISO weekday: 1 = Monday … 7 = Sunday. */
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1;

/**
 * Counts working days between two ISO dates, inclusive: days that are in the company's working week
 * (`workDays`, ISO 1 = Mon … 7 = Sun; default Mon–Fri) and are not Czech state holidays.
 * Mirrors count_working_days() in schema.sql — the database recomputes the same number on every request.
 */
export function countWorkingDays(startISO: string, endISO: string, workDays: number[] = DEFAULT_WORK_DAYS): number {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (end < start) return 0;

  let count = 0;
  let cursor = start;
  while (cursor <= end) {
    if (workDays.includes(isoWeekday(cursor)) && !isCzechHoliday(cursor)) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

interface SpanLike {
  start_date: string;
  end_date: string;
  working_days: number | string;
}

/**
 * Working days of a request that fall inside [from, to] (ISO dates). A request fully inside the range keeps
 * its stored number (that covers half days and hours); one that crosses the boundary is re-counted for the
 * overlapping part, so a 28. 9. – 5. 10. absence is split between September and October.
 */
export function daysWithin(r: SpanLike, from: string, to: string, workDays: number[] = DEFAULT_WORK_DAYS): number {
  if (r.end_date < from || r.start_date > to) return 0;
  if (r.start_date >= from && r.end_date <= to) return Number(r.working_days);
  const s = r.start_date > from ? r.start_date : from;
  const e = r.end_date < to ? r.end_date : to;
  return countWorkingDays(s, e, workDays);
}

/**
 * Correct Czech noun form for a day count. Non-integer amounts (half-days,
 * hourly requests converted to e.g. 0.5 or 1.5) always take the genitive
 * singular "dne" ("0,5 dne", "1,5 dne"), never "dny" — that form is only for
 * a whole 2–4. Whole numbers still follow the usual 1 / 2–4 / 5+ split.
 */
export function dayWord(n: number): "den" | "dne" | "dny" | "dní" {
  if (!Number.isInteger(n)) return "dne";
  if (n === 1) return "den";
  if (n >= 2 && n <= 4) return "dny";
  return "dní";
}

/** "X pracovní(ho) den/dne/dny/dní", with "pracovní" itself correctly declined. */
export function workingDaysPhrase(n: number): string {
  const word = dayWord(n);
  const adjective = word === "dne" ? "pracovního" : word === "dní" ? "pracovních" : "pracovní";
  return `${n} ${adjective} ${word}`;
}

export function formatRange(startISO: string, endISO: string): string {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (isSameDay(start, end)) return format(start, "d. M. yyyy");
  return `${format(start, "d. M.")} – ${format(end, "d. M. yyyy")}`;
}
