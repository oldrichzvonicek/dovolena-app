import { describe, expect, it } from "vitest";
import { addDaysIso, changeKind, downgradeEffectiveDate, overLimitBy, quoteUpgrade, remainingDays } from "./plan-change";
import { planByKey } from "./plans";

describe("plan change", () => {
  it("counts remaining days inclusively and never negative", () => {
    expect(remainingDays("2026-12-31", "2026-07-01")).toBe(184);
    expect(remainingDays("2026-07-01", "2026-07-01")).toBe(1);
    expect(remainingDays("2026-06-30", "2026-07-01")).toBe(0);
    expect(remainingDays(null, "2026-07-01")).toBe(0);
  });

  it("adds days across month and year ends", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("quotes an upgrade pro rata by days: credit for the unused old plan, cost of the new one for the rest", () => {
    // Starter ročně 2 900 Kč, přechod na Pro ročně (11 900 Kč, do 30 lidí) 1. 7., zaplaceno do 31. 12.
    const q = quoteUpgrade({ from: planByKey("basic"), to: planByKey("pro"), users: 8, period: "yearly", paidUntil: "2026-12-31", today: "2026-07-01" })!;
    expect(q.remainingDays).toBe(184);
    expect(q.credit).toBe(Math.round((2900 * 184) / 365));
    expect(q.newCost).toBe(Math.round((11900 * 184) / 365));
    expect(q.toPay).toBe(q.newCost - q.credit);
    expect(q.toPay).toBeGreaterThan(0);
  });

  it("has no quote when the paid period is over, and never asks for a negative amount", () => {
    expect(quoteUpgrade({ from: planByKey("basic"), to: planByKey("pro"), users: 8, period: "yearly", paidUntil: "2026-06-30", today: "2026-07-01" })).toBeNull();
    const q = quoteUpgrade({ from: planByKey("pro"), to: planByKey("basic"), users: 8, period: "monthly", paidUntil: "2026-07-31", today: "2026-07-01" })!;
    expect(q.toPay).toBe(0);
  });

  it("uses monthly periods of 30 days", () => {
    const q = quoteUpgrade({ from: planByKey("basic"), to: planByKey("starter"), users: 8, period: "monthly", paidUntil: "2026-07-16", today: "2026-07-01" })!;
    expect(q.remainingDays).toBe(16);
    expect(q.periodDays).toBe(30);
    expect(q.credit).toBe(Math.round((290 * 16) / 30));
  });

  it("recognizes upgrades, downgrades and no change", () => {
    expect(changeKind("basic", "pro")).toBe("upgrade");
    expect(changeKind("pro", "starter")).toBe("downgrade");
    expect(changeKind("starter", "starter")).toBe("same");
    expect(changeKind("enterprise", "pro")).toBe("same");
  });

  it("makes a downgrade effective the day after the last paid day", () => {
    expect(downgradeEffectiveDate("2026-12-31", "2026-07-01")).toBe("2027-01-01");
    expect(downgradeEffectiveDate("2026-06-30", "2026-07-01")).toBe("2026-07-02");
    expect(downgradeEffectiveDate(null, "2026-07-01")).toBeNull();
  });

  it("reports how many active users exceed the new plan's limit", () => {
    expect(overLimitBy("free", 8)).toBe(3);
    expect(overLimitBy("starter", 15)).toBe(0);
    expect(overLimitBy("pro", 500)).toBe(0);
  });
});
