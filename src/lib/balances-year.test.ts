import { describe, expect, it } from "vitest";
import { computeBalance, remainingOf } from "./balances";

const vac = { counts_against: "vacation" };
const ent = (year: number, total: number) => ({ profile_id: "p", year, total_days: total, opening_used_days: 0, leave_type: vac });
const req = (start: string, end: string, days: number) => ({ id: start, profile_id: "p", start_date: start, end_date: end, working_days: days, leave_type: vac });
const draft = (start: string, end: string, days: number) => ({ ...req(start, end, days), isDraft: true });
const noCarry = { max: null, expiryMD: null };

describe("absences over New Year", () => {
  // Mon 29. 12. 2025 – Fri 2. 1. 2026: 29., 30., 31. 12. + 2. 1. (1. 1. is a holiday) = 4 working days
  const r = req("2025-12-29", "2026-01-02", 4);
  it("books the December days to the old year and the January days to the new one", () => {
    expect(computeBalance("vacation", [ent(2025, 20)], [r], 2025, "2026-03-01", noCarry).used).toBe(3);
    expect(computeBalance("vacation", [ent(2026, 20)], [r], 2026, "2026-03-01", noCarry).used).toBe(1);
  });
  it("splits the total exactly (nothing lost, nothing counted twice)", () => {
    const a = computeBalance("vacation", [ent(2025, 20)], [r], 2025, "2026-03-01", noCarry).used;
    const b = computeBalance("vacation", [ent(2026, 20)], [r], 2026, "2026-03-01", noCarry).used;
    expect(a + b).toBe(4);
  });
});

describe("soukromé návrhy (leave_plans)", () => {
  it("jdou do planned, ne do upcoming — a nepočítají se do remainingOf", () => {
    const approved = req("2026-06-01", "2026-06-05", 5);
    const d = draft("2026-09-01", "2026-09-03", 3);
    const b = computeBalance("vacation", [ent(2026, 20)], [approved, d], 2026, "2026-03-01", noCarry);
    expect(b.upcoming).toBe(5);
    expect(b.planned).toBe(3);
    expect(remainingOf(b)).toBe(20 - 5);
  });

  it("samotný návrh bez schválené žádosti nesníží zbývá vůbec", () => {
    const d = draft("2026-09-01", "2026-09-03", 3);
    const b = computeBalance("vacation", [ent(2026, 20)], [d], 2026, "2026-03-01", noCarry);
    expect(b.used).toBe(0);
    expect(b.upcoming).toBe(0);
    expect(b.planned).toBe(3);
    expect(remainingOf(b)).toBe(20);
  });
});
