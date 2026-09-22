import { addDays, isWeekend, isSameDay, parseISO, format } from "date-fns";

/**
 * Czech state holidays. Fixed-date holidays only (the Czech calendar has no
 * moving public holidays other than Good Friday and Easter Monday, which are
 * computed below from the Easter algorithm).
 */
function fixedCzechHolidays(year: number): Date[] {
  const d = (month: number, day: number) => new Date(year, month - 1, day);
  return [
    d(1, 1), // Nový rok / Den obnovy samostatného českého státu
    d(5, 1), // Svátek práce
    d(5, 8), // Den vítězství
    d(7, 5), // Den slovanských věrozvěstů Cyrila a Metoděje
    d(7, 6), // Den upálení mistra Jana Husa
    d(9, 28), // Den české státnosti
    d(10, 28), // Den vzniku samostatného československého státu
    d(11, 17), // Den boje za svobodu a demokracii
    d(12, 24), // Štědrý den
    d(12, 25), // 1. svátek vánoční
    d(12, 26), // 2. svátek vánoční
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

export function czechHolidays(year: number): Date[] {
  const easter = easterSunday(year);
  return [
    ...fixedCzechHolidays(year),
    addDays(easter, -2), // Velký pátek (Good Friday)
    addDays(easter, 1), // Velikonoční pondělí (Easter Monday)
  ];
}

export function isCzechHoliday(date: Date): boolean {
  return czechHolidays(date.getFullYear()).some((h) => isSameDay(h, date));
}

/** Counts working days (Mon–Fri, excluding Czech state holidays) between two ISO dates, inclusive. */
export function countWorkingDays(startISO: string, endISO: string): number {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (end < start) return 0;

  let count = 0;
  let cursor = start;
  while (cursor <= end) {
    if (!isWeekend(cursor) && !isCzechHoliday(cursor)) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function formatRange(startISO: string, endISO: string): string {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (isSameDay(start, end)) return format(start, "d. M. yyyy");
  return `${format(start, "d. M.")} – ${format(end, "d. M. yyyy")}`;
}
