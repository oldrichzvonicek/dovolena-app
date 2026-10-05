import { describe, expect, it } from "vitest";
import { daysLeft, dueDate, isDsrType, isDueSoon } from "./dsr";

describe("GDPR žádosti", () => {
  it("lhůta je 30 dní od přijetí", () => {
    expect(dueDate("2026-09-01")).toBe("2026-10-01");
    expect(dueDate("2026-12-15")).toBe("2027-01-14");
  });

  it("daysLeft: kladné před lhůtou, záporné po ní", () => {
    expect(daysLeft("2026-10-01", "2026-09-28")).toBe(3);
    expect(daysLeft("2026-10-01", "2026-10-03")).toBe(-2);
  });

  it("upozornění 7 dní před lhůtou, vyřízené se nehlídají", () => {
    expect(isDueSoon({ status: "received", due_at: "2026-10-05" }, "2026-09-28")).toBe(true);
    expect(isDueSoon({ status: "forwarded", due_at: "2026-10-06" }, "2026-09-28")).toBe(false);
    expect(isDueSoon({ status: "received", due_at: "2026-09-20" }, "2026-09-28")).toBe(true);
    expect(isDueSoon({ status: "resolved", due_at: "2026-09-20" }, "2026-09-28")).toBe(false);
  });

  it("isDsrType", () => {
    expect(isDsrType("erasure")).toBe(true);
    expect(isDsrType("delete")).toBe(false);
  });
});
