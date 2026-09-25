import { describe, expect, it } from "vitest";
import { MIN_GROUP, approvalSpeed, bridgeSuggestions, capacityHeatmap, hrDigest, sickShareByDepartment, vacationLiability } from "./insights";

const sick = { key: "sick", counts_against: "sick" };
const vac = { key: "dovolena", counts_against: "vacation" };
const people = (n: number, dept: string) => Array.from({ length: n }, (_, i) => ({ id: `${dept}-${i}`, department_id: dept }));

describe("sickShareByDepartment (anonymní souhrn)", () => {
  const depts = [
    { id: "big", name: "Velké" },
    { id: "small", name: "Malé" },
  ];
  const ppl = [...people(10, "big"), ...people(MIN_GROUP - 1, "small")];
  // 10 lidí × 20 pracovních dní (říjen 2026 bez svátku 28. 10.: 22 pracovních - 1 svátek = 21)
  const reqs = [
    { profile_id: "big-0", start_date: "2026-10-05", end_date: "2026-10-06", working_days: 2, leave_type: sick },
    { profile_id: "small-0", start_date: "2026-10-05", end_date: "2026-10-05", working_days: 1, leave_type: sick },
    { profile_id: "big-1", start_date: "2026-10-12", end_date: "2026-10-16", working_days: 5, leave_type: vac },
  ];
  const r = sickShareByDepartment(ppl, depts, reqs, "2026-10-01", "2026-10-31");

  it("nikdy nevrací jména ani jednotlivce", () => {
    expect(JSON.stringify(r)).not.toMatch(/big-0|small-0/);
  });
  it("skryje oddělení menší než minimální skupina", () => {
    expect(r.rows.map((x) => x.dept)).toEqual(["Velké"]);
    expect(r.hiddenDepartments).toBe(1);
  });
  it("počítá jen nemoc, ne dovolenou", () => {
    expect(r.rows[0].sickDays).toBe(2);
  });
  it("podíl je v procentech pracovních dnů", () => {
    expect(r.rows[0].sharePct).toBeGreaterThan(0);
    expect(r.rows[0].sharePct).toBeLessThan(2);
  });
});

describe("capacityHeatmap", () => {
  const depts = [{ id: "d", name: "Obchod", capacity_warning_percent: null }];
  const ppl = people(5, "d");
  it("označí týden, kdy chybí příliš mnoho lidí, a oddělí čekající žádosti", () => {
    const reqs = [
      { profile_id: "d-0", start_date: "2026-11-02", end_date: "2026-11-06", working_days: 5, status: "approved", leave_type: vac },
      { profile_id: "d-1", start_date: "2026-11-02", end_date: "2026-11-06", working_days: 5, status: "approved", leave_type: vac },
      { profile_id: "d-2", start_date: "2026-11-03", end_date: "2026-11-04", working_days: 2, status: "pending", leave_type: vac },
    ];
    const rows = capacityHeatmap({ people: ppl, depts, requests: reqs, from: "2026-11-02", weeks: 2, companyThresholdPct: 30 });
    expect(rows).toHaveLength(1);
    const w = rows[0].weeks[0];
    expect(w.peakCount).toBe(2);
    expect(w.peakPct).toBe(40);
    expect(w.breach).toBe(true);
    expect(w.pendingPct).toBe(20);
    expect(rows[0].weeks[1].peakCount).toBe(0);
  });
  it("Home Office nesnižuje kapacitu", () => {
    const reqs = [{ profile_id: "d-0", start_date: "2026-11-02", end_date: "2026-11-06", working_days: 5, status: "approved", leave_type: { key: "home_office" } }];
    expect(capacityHeatmap({ people: ppl, depts, requests: reqs, from: "2026-11-02", weeks: 1, companyThresholdPct: 30 })[0].weeks[0].peakCount).toBe(0);
  });
  it("vynechá oddělení s jedním člověkem", () => {
    expect(capacityHeatmap({ people: people(1, "x"), depts: [{ id: "x", name: "X", capacity_warning_percent: null }], requests: [], from: "2026-11-02", weeks: 1, companyThresholdPct: 30 })).toHaveLength(0);
  });
});

describe("approvalSpeed", () => {
  const submitted = new Map([
    ["r1", "2026-10-01T08:00:00Z"],
    ["r2", "2026-10-01T08:00:00Z"],
    ["r3", "2026-10-01T08:00:00Z"],
    ["r4", "2026-10-01T08:00:00Z"],
  ]);
  const dec = (id: string, actor: string, hours: number, action = "request.approved") => ({ actor_id: actor, entity_id: id, action, created_at: new Date(new Date("2026-10-01T08:00:00Z").getTime() + hours * 3600000).toISOString() });
  it("medián a podíl zamítnutí po schvalovatelích, jen s dostatkem rozhodnutí", () => {
    const r = approvalSpeed([dec("r1", "a", 2), dec("r2", "a", 4), dec("r3", "a", 30, "request.rejected"), dec("r4", "b", 1)], submitted, 3);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ actorId: "a", decisions: 3, medianHours: 4, rejectedPct: 33 });
  });
  it("ignoruje rozhodnutí bez známého podání", () => {
    expect(approvalSpeed([dec("neznama", "a", 1)], submitted, 1).rows).toHaveLength(0);
  });
});

describe("vacationLiability", () => {
  it("sečte nevyčerpané dny, dny nad strop převodu propadnou, částka podle sazby", () => {
    const l = vacationLiability([10, 3, -2, 0], 5, 2000);
    expect(l.totalDays).toBe(13);
    expect(l.forfeitDays).toBe(5);
    expect(l.amount).toBe(26000);
    expect(l.forfeitAmount).toBe(10000);
  });
  it("bez sazby částku nevrací, bez stropu nic nepropadá", () => {
    const l = vacationLiability([10], null, null);
    expect(l.amount).toBeNull();
    expect(l.forfeitDays).toBe(0);
  });
});

describe("bridgeSuggestions", () => {
  it("Den české státnosti v pondělí: žádný můstek není potřeba, ale čtvrtek 29. 10. 2026 zaměřen na 28. 10. (středa) vytvoří dlouhý víkend", () => {
    // 28. 10. 2026 je středa (svátek); čtvrtek a pátek 29.–30. 10. + víkend = 5 dní volna při 2 dnech dovolené... stačí 2 dny
    const s = bridgeSuggestions("2026-10-20", 20);
    const hit = s.find((x) => x.holiday && x.offStart <= "2026-10-28" && x.offEnd >= "2026-10-28");
    expect(hit).toBeTruthy();
    expect(hit!.take.length).toBeLessThanOrEqual(2);
    expect(hit!.offDays).toBeGreaterThanOrEqual(4);
  });
  it("žádné návrhy nezahrnují dny mimo horizont", () => {
    const s = bridgeSuggestions("2026-10-20", 5);
    expect(s.every((x) => x.take.every((t) => t <= "2026-10-25"))).toBe(true);
  });
  it("každý návrh dá aspoň 4 dny volna a vezme nejvýš 2", () => {
    for (const x of bridgeSuggestions("2026-01-01", 365)) {
      expect(x.offDays).toBeGreaterThanOrEqual(4);
      expect(x.take.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("hrDigest", () => {
  it("nic neposílá, když není co řešit", () => {
    expect(hrDigest({ capacityBreaches: [], liability: vacationLiability([], null, null), slowPending: 0, pendingTotal: 0, medianDecisionHours: 5 })).toBeNull();
  });
  it("sestaví přehled s podkapacitou a propadnutím dovolené", () => {
    const d = hrDigest({
      capacityBreaches: [{ dept: "Obchod", weekStart: "2026-11-02", pct: 40, count: 2, size: 5 }],
      liability: vacationLiability([12], 5, 2000),
      slowPending: 2,
      pendingTotal: 6,
      medianDecisionHours: 7.5,
    });
    expect(d!.body).toContain("Obchod");
    expect(d!.body).toContain("2 z 6");
    expect(d!.body).toMatch(/propadne/);
    expect(d!.body).toContain("14");
  });
});
