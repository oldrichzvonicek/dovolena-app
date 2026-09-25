import { describe, expect, it } from "vitest";
import { computeBalance, remainingOf } from "./balances";

const vac = { counts_against: "vacation" };
const ent = (year: number, total: number, opening = 0) => ({ profile_id: "p", year, total_days: total, opening_used_days: opening, leave_type: vac });
const req = (start: string, end: string, days: number) => ({ id: start, profile_id: "p", start_date: start, end_date: end, working_days: days, leave_type: vac });
const noCarry = { max: null, expiryMD: null };

describe("computeBalance", () => {
  it("counts only absences that start in the given year", () => {
    const b = computeBalance("vacation", [ent(2026, 20)], [req("2025-05-05", "2025-05-14", 8), req("2026-02-02", "2026-02-04", 3)], 2026, "2026-09-25", noCarry);
    expect(b.used).toBe(3);
    expect(remainingOf(b)).toBe(17);
  });

  it("splits used vs upcoming by end date", () => {
    const b = computeBalance("vacation", [ent(2026, 20)], [req("2026-02-02", "2026-02-04", 3), req("2026-12-01", "2026-12-03", 3)], 2026, "2026-09-25", noCarry);
    expect(b.used).toBe(3);
    expect(b.upcoming).toBe(3);
  });

  it("includes the opening balance as already used", () => {
    const b = computeBalance("vacation", [ent(2026, 20, 5)], [], 2026, "2026-09-25", noCarry);
    expect(b.used).toBe(5);
  });

  it("carries unused days over, capped by max_carryover_days", () => {
    const b = computeBalance("vacation", [ent(2025, 20), ent(2026, 20)], [req("2025-05-05", "2025-05-14", 8)], 2026, "2026-01-10", { max: 5, expiryMD: null });
    expect(b.carryover).toBe(5);
    expect(b.total).toBe(25);
  });

  it("forfeits unused carryover after the expiry date but keeps what was used first", () => {
    const entries = [ent(2025, 20), ent(2026, 20)];
    const unused = computeBalance("vacation", entries, [], 2026, "2026-06-01", { max: 10, expiryMD: "03-31" });
    expect(unused.carryover).toBe(0);
    const used = computeBalance("vacation", entries, [req("2026-02-02", "2026-02-05", 4)], 2026, "2026-06-01", { max: 10, expiryMD: "03-31" });
    expect(used.carryover).toBe(4);
  });

  it("never carries over for sick days", () => {
    const sick = { counts_against: "sick" };
    const b = computeBalance("sick", [{ ...ent(2025, 5), leave_type: sick }, { ...ent(2026, 5), leave_type: sick }], [], 2026, "2026-01-10", noCarry);
    expect(b.carryover).toBe(0);
    expect(b.total).toBe(5);
  });
});
