import { describe, expect, it } from "vitest";
import { buildPayrollRows, detailToTable, splitName, summarizePayroll, toCsv, type PayrollPerson, type PayrollRequest } from "./payroll";
import { ceilHalf, settleVacation } from "./settlement";

const people: PayrollPerson[] = [
  { id: "1", name: "Jan Karel Novák", email: "jan@x.cz", departmentName: "Obchod", personalNumber: "101" },
  { id: "2", name: "Petra Svobodová", email: null, departmentName: "Sklad", personalNumber: "" },
];
const vacation = { key: "dovolena", label: "Dovolená", payroll_code: "D", counts_against: "vacation" };
const sick = { key: "sick", label: "Sick Day", payroll_code: null, counts_against: "sick" };

describe("payroll rows", () => {
  it("splits names into first and last name", () => {
    expect(splitName("Jan Karel Novák")).toEqual({ firstName: "Jan Karel", lastName: "Novák" });
    expect(splitName("Madonna")).toEqual({ firstName: "", lastName: "Madonna" });
  });

  it("clips absences to the month and counts only working days inside it", () => {
    // 28. 9. – 2. 10. 2026: 28. 9. je státní svátek, takže v září jsou pracovní jen 29. a 30. (2 dny); v říjnu 1. a 2. (2 dny)
    const reqs: PayrollRequest[] = [{ profile_id: "1", start_date: "2026-09-28", end_date: "2026-10-02", working_days: 4, leave_type: vacation }];
    const sep = buildPayrollRows(reqs, people, "2026-09", { hoursPerDay: 8 });
    const oct = buildPayrollRows(reqs, people, "2026-10", { hoursPerDay: 8 });
    expect(sep).toHaveLength(1);
    expect(sep[0]).toMatchObject({ from: "2026-09-28", to: "2026-09-30", days: 2, hours: 16, code: "D", lastName: "Novák", firstName: "Jan Karel", personalNumber: "101" });
    expect(oct[0]).toMatchObject({ from: "2026-10-01", to: "2026-10-02", days: 2, hours: 16 });
  });

  it("keeps half days and skips absences outside the month or of unknown people", () => {
    const reqs: PayrollRequest[] = [
      { profile_id: "2", start_date: "2026-09-10", end_date: "2026-09-10", working_days: 0.5, half_day: true, leave_type: sick },
      { profile_id: "2", start_date: "2026-08-10", end_date: "2026-08-12", working_days: 3, leave_type: vacation },
      { profile_id: "999", start_date: "2026-09-10", end_date: "2026-09-10", working_days: 1, leave_type: vacation },
    ];
    const rows = buildPayrollRows(reqs, people, "2026-09", { hoursPerDay: 8 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ days: 0.5, hours: 4, halfDay: true, code: "" });
  });

  it("leaves out working types (home office) unless asked", () => {
    const ho = { key: "home_office", label: "Home Office", payroll_code: null, counts_against: "none", counts_as_present: true };
    const reqs: PayrollRequest[] = [{ profile_id: "1", start_date: "2026-09-10", end_date: "2026-09-10", working_days: 1, leave_type: ho }];
    expect(buildPayrollRows(reqs, people, "2026-09", { hoursPerDay: 8 })).toHaveLength(0);
    expect(buildPayrollRows(reqs, people, "2026-09", { hoursPerDay: 8, includeWorking: true })).toHaveLength(1);
  });

  it("summarizes by person and type", () => {
    const reqs: PayrollRequest[] = [
      { profile_id: "1", start_date: "2026-09-01", end_date: "2026-09-02", working_days: 2, leave_type: vacation },
      { profile_id: "1", start_date: "2026-09-15", end_date: "2026-09-15", working_days: 1, leave_type: vacation },
      { profile_id: "1", start_date: "2026-09-16", end_date: "2026-09-16", working_days: 1, leave_type: sick },
    ];
    const s = summarizePayroll(buildPayrollRows(reqs, people, "2026-09", { hoursPerDay: 7.5 }));
    expect(s).toHaveLength(2);
    expect(s.find((r) => r.typeLabel === "Dovolená")).toMatchObject({ days: 3, hours: 22.5 });
  });

  it("writes Excel-friendly CSV: semicolons, decimal comma, BOM and formula protection", () => {
    const reqs: PayrollRequest[] = [{ profile_id: "1", start_date: "2026-09-10", end_date: "2026-09-10", working_days: 0.5, half_day: true, leave_type: vacation }];
    const rows = buildPayrollRows(reqs, [{ ...people[0], name: "=Jan Novák" }], "2026-09", { hoursPerDay: 8 });
    const csv = toCsv(["A", "B"], detailToTable(rows));
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain(";");
    expect(csv).toContain('"0,5"');
    expect(csv).toContain("\"'=Jan\"");
  });
});

describe("vacation settlement on termination", () => {
  it("rounds up to half days", () => {
    expect(ceilHalf(12.1)).toBe(12.5);
    expect(ceilHalf(12.5)).toBe(12.5);
    expect(ceilHalf(12.0)).toBe(12);
    expect(ceilHalf(8.3333)).toBe(8.5);
  });

  it("prorates the year's entitlement by months worked (month of termination counts fully)", () => {
    // 25 dní, odchod 31. 7. → 7 měsíců: 25 × 7/12 = 14,58 → 15
    const s = settleVacation({ total: 25, carryover: 0, openingUsed: 0, requests: [], termination: "2026-07-31" });
    expect(s).toMatchObject({ months: 7, prorated: 15, entitled: 15, used: 0, balance: 15 });
  });

  it("uses the hire month when the employee started in the same year", () => {
    // nástup 1. 4., odchod 30. 6. → 3 měsíce: 20 × 3/12 = 5
    const s = settleVacation({ total: 20, carryover: 0, openingUsed: 0, requests: [], termination: "2026-06-30", hire: "2026-04-01" });
    expect(s).toMatchObject({ months: 3, prorated: 5 });
  });

  it("adds carry-over, subtracts used days and reports over-drawn balance as negative", () => {
    const s = settleVacation({
      total: 20,
      carryover: 2,
      openingUsed: 3,
      // 6.–10. 4. 2026 (po–pá) = 5 dní čerpáno před odchodem; 3.–7. 8. je až po odchodu 30. 6.
      requests: [
        { start_date: "2026-04-06", end_date: "2026-04-10", working_days: 5 },
        { start_date: "2026-08-03", end_date: "2026-08-07", working_days: 5 },
      ],
      termination: "2026-06-30",
    });
    // 6 měsíců → 10 + 2 převod = 12; čerpáno 3 + 5 = 8; zbývá 4; po odchodu naplánováno 5
    expect(s).toMatchObject({ months: 6, prorated: 10, entitled: 12, used: 8, balance: 4, plannedAfter: 5 });
    const over = settleVacation({ total: 20, carryover: 0, openingUsed: 15, requests: [], termination: "2026-03-31" });
    expect(over.balance).toBe(-10); // 3 měsíce = 5 dní, čerpáno 15
  });

  it("gives the whole year when leaving on 31 December", () => {
    expect(settleVacation({ total: 25, carryover: 0, openingUsed: 0, requests: [], termination: "2026-12-31" })).toMatchObject({ months: 12, prorated: 25, plannedAfter: 0 });
  });
});
