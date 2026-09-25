import { describe, expect, it } from "vitest";
import { countWorkingDays, daysWithin } from "./working-days";

describe("countWorkingDays with a company working week", () => {
  it("defaults to Monday–Friday", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11")).toBe(5);
  });
  it("counts Saturday for a six-day week", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", [1, 2, 3, 4, 5, 6])).toBe(6);
  });
  it("counts weekend-only shops", () => {
    expect(countWorkingDays("2026-10-05", "2026-10-11", [6, 7])).toBe(2);
  });
  it("still skips Czech holidays on working weekdays (28. 9. 2026 is a Monday)", () => {
    expect(countWorkingDays("2026-09-28", "2026-09-29")).toBe(1);
  });
  it("Easter 2026: Good Friday (3. 4.) and Easter Monday (6. 4.) are not working days", () => {
    expect(countWorkingDays("2026-04-02", "2026-04-07")).toBe(2); // Thu 2, Tue 7
  });
});

describe("daysWithin splits requests across month boundaries", () => {
  const r = { start_date: "2026-09-28", end_date: "2026-10-05", working_days: 5 }; // 28.9 is a holiday
  it("gives each month its own share", () => {
    const sep = daysWithin(r, "2026-09-01", "2026-09-30");
    const oct = daysWithin(r, "2026-10-01", "2026-10-31");
    expect(sep).toBe(2); // 29., 30.
    expect(oct).toBe(3); // 1., 2., 5.
    expect(sep + oct).toBe(5);
  });
  it("keeps the stored number (half days, hours) for requests fully inside", () => {
    expect(daysWithin({ start_date: "2026-10-07", end_date: "2026-10-07", working_days: 0.5 }, "2026-10-01", "2026-10-31")).toBe(0.5);
  });
  it("is 0 outside the range", () => {
    expect(daysWithin(r, "2026-11-01", "2026-11-30")).toBe(0);
  });
});
