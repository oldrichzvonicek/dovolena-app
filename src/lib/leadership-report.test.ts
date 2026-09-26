import { describe, expect, it } from "vitest";
import { estimateTimeSaved, forfeitRisk, reportText } from "./leadership-report";

describe("estimateTimeSaved", () => {
  it("počet žádostí × minuty na žádost, částka jen při známé sazbě", () => {
    const s = estimateTimeSaved(84, 6, 2400, 8);
    expect(s.hours).toBe(8.4);
    expect(s.amount).toBe(2520); // 8,4 h × 300 Kč/h
    expect(estimateTimeSaved(10, 6, null, 8).amount).toBeNull();
    expect(estimateTimeSaved(10, -5, null, 8).hours).toBe(0);
  });
});

describe("forfeitRisk", () => {
  const names = new Map([["d", "Obchod"], ["s", "Malé"]]);
  const big = Array.from({ length: 6 }, (_, i) => ({ departmentId: "d", remaining: i < 2 ? 14 : 3 }));
  it("dny nad strop převodu propadnou, částka podle sazby", () => {
    const r = forfeitRisk(big, names, 5, 2500);
    expect(r.totalDays).toBe(18); // 2 × (14 − 5)
    expect(r.people).toBe(2);
    expect(r.amount).toBe(45000);
    expect(r.byDept[0]).toMatchObject({ dept: "Obchod", people: 2, days: 18 });
    expect(r.atRiskPeople).toBe(2);
  });
  it("bez stropu nic nepropadá; malé oddělení se sloučí do Ostatní", () => {
    expect(forfeitRisk(big, names, null, null).totalDays).toBe(0);
    const small = [{ departmentId: "s", remaining: 20 }, { departmentId: "s", remaining: 20 }];
    const r = forfeitRisk(small, names, 5, null);
    expect(r.byDept).toEqual([{ dept: "Ostatní (menší oddělení)", people: 2, days: 30 }]);
    expect(r.amount).toBeNull();
  });
});

describe("reportText", () => {
  it("shrnutí obsahuje odhad výslovně jako odhad", () => {
    const t = reportText({ company: "Firma", period: "září 2026", saved: estimateTimeSaved(84, 6, null, 8), medianHours: 3.3, risk: forfeitRisk([], new Map(), 5, null), collisions: 0, noSubstitute: 2 });
    expect(t).toContain("odhad");
    expect(t).toContain("8,4 h");
    expect(t).toContain("Lidí bez určeného zástupu: 2");
  });
});
