import { DEFAULT_WORK_DAYS, daysWithin } from "@/lib/working-days";
import { safeCell } from "@/lib/csv";

/**
 * Detailní měsíční podklad pro mzdy: jeden řádek = jedna schválená absence oříznutá na měsíc (absence přes přelom
 * měsíců se rozdělí). Čisté funkce, aby šly testovat; načítání dat a stahování řeší komponenta.
 */

export interface PayrollRequest {
  profile_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  half_day?: boolean;
  leave_type: { key: string; label: string; payroll_code: string | null; counts_against: string; counts_as_present?: boolean } | null;
}

export interface PayrollPerson {
  id: string;
  name: string;
  email: string | null;
  departmentName: string;
  personalNumber: string;
}

export interface PayrollRow {
  personalNumber: string;
  lastName: string;
  firstName: string;
  department: string;
  from: string;
  to: string;
  days: number;
  hours: number;
  typeLabel: string;
  code: string;
  halfDay: boolean;
}

export interface PayrollSummaryRow {
  personalNumber: string;
  lastName: string;
  firstName: string;
  department: string;
  typeLabel: string;
  code: string;
  days: number;
  hours: number;
}

/** „Jan Karel Novák“ → příjmení „Novák“, jméno „Jan Karel“ (poslední slovo je příjmení). */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] ?? "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

const monthBounds = (month: string) => {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildPayrollRows(
  requests: PayrollRequest[],
  people: PayrollPerson[],
  month: string,
  opts: { workDays?: number[]; hoursPerDay: number; /** Zahrnout i typy, kdy člověk pracuje (Home Office, služební cesta). Výchozí: ne — pro mzdy nejsou nepřítomností. */ includeWorking?: boolean }
): PayrollRow[] {
  const { start, end } = monthBounds(month);
  const workDays = opts.workDays ?? DEFAULT_WORK_DAYS;
  const byId = new Map(people.map((p) => [p.id, p]));
  const rows: PayrollRow[] = [];
  for (const r of requests) {
    const person = byId.get(r.profile_id);
    if (!person || !r.leave_type) continue;
    if (r.leave_type.counts_as_present && !opts.includeWorking) continue;
    if (r.end_date < start || r.start_date > end) continue;
    const days = round1(r.half_day ? Number(r.working_days) : daysWithin(r, start, end, workDays));
    if (days <= 0) continue;
    const { firstName, lastName } = splitName(person.name);
    rows.push({
      personalNumber: person.personalNumber,
      lastName,
      firstName,
      department: person.departmentName,
      from: r.start_date > start ? r.start_date : start,
      to: r.end_date < end ? r.end_date : end,
      days,
      hours: round1(days * opts.hoursPerDay),
      typeLabel: r.leave_type.label,
      code: r.leave_type.payroll_code ?? "",
      halfDay: !!r.half_day,
    });
  }
  return rows.sort((a, b) => a.lastName.localeCompare(b.lastName, "cs") || a.firstName.localeCompare(b.firstName, "cs") || a.from.localeCompare(b.from));
}

/** Součty za člověka a typ absence (dny i hodiny). */
export function summarizePayroll(rows: PayrollRow[]): PayrollSummaryRow[] {
  const map = new Map<string, PayrollSummaryRow>();
  for (const r of rows) {
    const key = `${r.personalNumber}|${r.lastName}|${r.firstName}|${r.typeLabel}`;
    const cur = map.get(key) ?? { personalNumber: r.personalNumber, lastName: r.lastName, firstName: r.firstName, department: r.department, typeLabel: r.typeLabel, code: r.code, days: 0, hours: 0 };
    cur.days = round1(cur.days + r.days);
    cur.hours = round1(cur.hours + r.hours);
    map.set(key, cur);
  }
  return Array.from(map.values());
}

const czDate = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;
const czNum = (n: number) => String(n).replace(".", ",");

export const DETAIL_HEADERS = ["Osobní číslo", "Příjmení", "Jméno", "Oddělení", "Od", "Do", "Pracovních dnů", "Hodin", "Typ absence", "Kód pro mzdy"];
export const SUMMARY_HEADERS = ["Osobní číslo", "Příjmení", "Jméno", "Oddělení", "Typ absence", "Kód pro mzdy", "Pracovních dnů", "Hodin"];

export const detailToTable = (rows: PayrollRow[]): string[][] =>
  rows.map((r) => [r.personalNumber, r.lastName, r.firstName, r.department, czDate(r.from), czDate(r.to), czNum(r.days), czNum(r.hours), r.typeLabel, r.code]);

export const summaryToTable = (rows: PayrollSummaryRow[]): string[][] =>
  rows.map((r) => [r.personalNumber, r.lastName, r.firstName, r.department, r.typeLabel, r.code, czNum(r.days), czNum(r.hours)]);

/** CSV pro Excel a účetní software v ČR: středník, desetinná čárka, BOM kvůli diakritice; buňky chráněné proti vzorcům. */
export function toCsv(headers: string[], rows: string[][]): string {
  const q = (v: string) => `"${safeCell(v).replace(/"/g, '""')}"`;
  return "﻿" + [headers.map(q).join(";"), ...rows.map((r) => r.map(q).join(";"))].join("\r\n");
}
