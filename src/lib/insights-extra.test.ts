import { describe, expect, it } from "vitest";
import { bridgeShare, decisionStats, homeOfficeShare, joinersLeavers, keyPeopleRisk, leadTime, sickPattern, substituteRisk, vacationCurve, weeklyFindings, type ExtraResults, type XPerson, type XRequest } from "./insights-extra";

const vac = { key: "dovolena", counts_against: "vacation" };
const sickT = { key: "sick", counts_against: "sick" };
const ho = { key: "home_office", counts_against: "none", counts_as_present: true };
const req = (o: Partial<XRequest> & { profile_id: string; start_date: string; end_date: string }): XRequest => ({
  working_days: 1,
  status: "approved",
  created_at: "2026-01-01T08:00:00Z",
  leave_type: vac,
  ...o,
});
const person = (id: string, dept: string | null = "d", extra: Partial<XPerson> = {}): XPerson => ({
  id,
  name: id,
  department_id: dept,
  substitute_id: null,
  active: true,
  created_at: "2020-01-01T00:00:00Z",
  deactivated_at: null,
  ...extra,
});
const six = ["a", "b", "c", "d", "e", "f"].map((i) => person(i));
const WD = [1, 2, 3, 4, 5];

describe("vacationCurve", () => {
  it("sečte dny po měsících a spočítá nenaplánované", () => {
    const r = vacationCurve(
      [req({ profile_id: "a", start_date: "2026-08-03", end_date: "2026-08-07", working_days: 5 }), req({ profile_id: "b", start_date: "2026-11-02", end_date: "2026-11-03", working_days: 2, status: "pending" })],
      "2026-09-26",
      WD,
      new Map([["a", 3], ["b", 4], ["c", 0]])
    );
    expect(r.months[7].days).toBe(5);
    expect(r.months[10].days).toBe(2);
    expect(r.unplanned).toEqual([{ id: "a", days: 3 }, { id: "b", days: 2 }]); // b má 2 dny už čekající
    expect(r.totalUnplanned).toBe(5);
    expect(r.weeksLeft).toBeGreaterThan(10);
  });
});

describe("bridgeShare", () => {
  it("pondělní a páteční dovolená navazuje na víkend, středeční ne", () => {
    const r = bridgeShare(
      [
        req({ profile_id: "a", start_date: "2026-09-07", end_date: "2026-09-07" }), // pondělí
        req({ profile_id: "a", start_date: "2026-09-09", end_date: "2026-09-09" }), // středa
      ],
      "2026-09-26",
      WD
    );
    expect(r.total).toBe(2);
    expect(r.adjoining).toBe(1);
    expect(r.byWeekday.find((w) => w.weekday === 1)?.days).toBe(1);
  });
});

describe("substituteRisk", () => {
  it("najde kolizi člověka a zástupu a lidi bez zástupu", () => {
    const people = [person("a", "d", { substitute_id: "b" }), person("b"), person("c")];
    const r = substituteRisk(
      people,
      [req({ profile_id: "a", start_date: "2026-10-05", end_date: "2026-10-09" }), req({ profile_id: "b", start_date: "2026-10-07", end_date: "2026-10-12" })],
      "2026-09-26"
    );
    expect(r.clashes).toEqual([{ personId: "a", substituteId: "b", from: "2026-10-07", to: "2026-10-09" }]);
    expect(r.noSubstitute.sort()).toEqual(["b", "c"]);
  });
  it("označí zástupce, který zastupuje tři lidi", () => {
    const people = [person("x"), person("a", "d", { substitute_id: "x" }), person("b", "d", { substitute_id: "x" }), person("c", "d", { substitute_id: "x" })];
    expect(substituteRisk(people, [], "2026-09-26").overloaded[0]).toMatchObject({ id: "x" });
  });
});

describe("leadTime", () => {
  it("počítá předstih a podíl žádostí na poslední chvíli", () => {
    const reqs = ["2026-08-01", "2026-08-01", "2026-08-01", "2026-08-01", "2026-08-01"].map((c, i) =>
      req({ profile_id: "a", start_date: i < 2 ? "2026-08-02" : "2026-09-01", end_date: i < 2 ? "2026-08-02" : "2026-09-01", created_at: `${c}T08:00:00Z` })
    );
    const r = leadTime(reqs, six, [{ id: "d", name: "Obchod" }], "2026-09-26");
    expect(r.overall.requests).toBe(5);
    expect(r.overall.shortPct).toBe(40);
    expect(r.rows[0].dept).toBe("Obchod");
  });
});

describe("decisionStats", () => {
  it("podíl zamítnutých po odděleních a schvalovatelích od pěti rozhodnutí", () => {
    const reqs = Array.from({ length: 6 }, (_, i) => req({ profile_id: "a", start_date: "2026-08-03", end_date: "2026-08-03", status: i < 3 ? "rejected" : "approved", approved_by: "boss", created_at: "2026-07-01T00:00:00Z" }));
    const r = decisionStats(reqs, six, [{ id: "d", name: "Obchod" }], "2026-09-26");
    expect(r.overall.rejectedPct).toBe(50);
    expect(r.byDept[0]).toMatchObject({ dept: "Obchod", rejectedPct: 50 });
    expect(r.byApprover[0]).toMatchObject({ approverId: "boss", decided: 6 });
  });
});

describe("sickPattern", () => {
  it("bez jmen a jen pro skupinu od pěti lidí", () => {
    const reqs = [req({ profile_id: "a", start_date: "2026-09-07", end_date: "2026-09-07", leave_type: sickT }), req({ profile_id: "b", start_date: "2026-09-09", end_date: "2026-09-09", leave_type: sickT })];
    expect(sickPattern(reqs, 4, "2026-09-26")).toBeNull();
    const r = sickPattern(reqs, 6, "2026-09-26")!;
    expect(r.shortEpisodes).toBe(2);
    expect(r.mondayFridayPct).toBe(50);
    expect(JSON.stringify(r)).not.toMatch(/"a"|"b"/);
  });
});

describe("homeOfficeShare", () => {
  it("podíl dní na Home Office", () => {
    const r = homeOfficeShare([req({ profile_id: "a", start_date: "2026-09-21", end_date: "2026-09-25", working_days: 5, leave_type: ho })], six, [{ id: "d", name: "Obchod" }], "2026-09-26", WD)!;
    expect(r.overallPct).toBeGreaterThan(0);
    expect(r.byWeekday).toHaveLength(5);
    expect(homeOfficeShare([], [person("a")], [], "2026-09-26", WD)).toBeNull();
  });
});

describe("keyPeopleRisk", () => {
  it("vedoucí i zástupce chybí zároveň", () => {
    const depts = [{ id: "d", name: "Obchod", head_profile_id: "h", deputy_head_profile_id: "z" }, { id: "e", name: "IT", head_profile_id: "i", deputy_head_profile_id: null }];
    const people = [person("h"), person("z"), person("i")];
    const r = keyPeopleRisk(depts, people, [req({ profile_id: "h", start_date: "2026-10-05", end_date: "2026-10-09" }), req({ profile_id: "z", start_date: "2026-10-08", end_date: "2026-10-16" })], "2026-09-26");
    expect(r.clashes).toEqual([{ dept: "Obchod", headId: "h", deputyId: "z", from: "2026-10-08", to: "2026-10-09" }]);
    expect(r.noDeputy).toEqual([{ dept: "IT", headId: "i" }]);
  });
});

describe("joinersLeavers", () => {
  it("nováčci do 90 dní, odchody s odhadem vyrovnání", () => {
    const people = [person("n", "d", { created_at: "2026-08-20T00:00:00Z" }), person("o", "d", { active: false, deactivated_at: "2026-09-01T00:00:00Z" })];
    const r = joinersLeavers(people, new Map([["n", 12], ["o", 4]]), "2026-09-26", 1000);
    expect(r.joiners).toEqual([{ id: "n", days: 12 }]);
    expect(r.leavers).toEqual([{ id: "o", remaining: 4, amount: 4000 }]);
  });
});

describe("weeklyFindings", () => {
  it("seřadí podle závažnosti a nepřidává nic navíc, když je vše v pořádku", () => {
    const empty: ExtraResults = {
      curve: vacationCurve([], "2026-09-26", WD, new Map()),
      bridge: bridgeShare([], "2026-09-26", WD),
      subs: { noSubstitute: [], overloaded: [], clashes: [] },
      lead: { overall: { requests: 0, medianDays: 0, shortPct: 0 }, rows: [] },
      decisions: { overall: { decided: 0, rejectedPct: 0 }, byDept: [], byApprover: [] },
      sick: null,
      home: null,
      key: { clashes: [], noDeputy: [] },
      moves: { joiners: [], leavers: [] },
    };
    expect(weeklyFindings(empty, "2026-09-26", (id) => id)).toEqual([]);
    const withIssues: ExtraResults = { ...empty, subs: { noSubstitute: ["x"], overloaded: [], clashes: [] }, key: { clashes: [{ dept: "IT", headId: "h", deputyId: "z", from: "2026-10-05", to: "2026-10-06" }], noDeputy: [] } };
    const f = weeklyFindings(withIssues, "2026-09-26", (id) => id);
    expect(f[0].severity).toBe(3);
    expect(f[f.length - 1].severity).toBe(1);
  });
});
