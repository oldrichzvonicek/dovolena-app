import { describe, expect, it } from "vitest";
import { carryoverExpiryWarning, czDays, czForm, czPeople, czRequests, weeklyDigestIntro } from "./czech";

describe("czForm", () => {
  it("1 → jednotné, 2–4 → množné, jinak 2. pád množného", () => {
    expect(czForm(1, "a", "b", "c")).toBe("a");
    for (const n of [2, 3, 4]) expect(czForm(n, "a", "b", "c")).toBe("b");
    for (const n of [0, 5, 11, 22, 24, 100, 105]) expect(czForm(n, "a", "b", "c")).toBe("c");
  });
});

describe("czPeople a czRequests", () => {
  it("skloňují podle počtu", () => {
    expect(czPeople(1)).toBe("1 člověk");
    expect(czPeople(3)).toBe("3 lidé");
    expect(czPeople(5)).toBe("5 lidí");
    expect(czRequests(1)).toBe("1 žádost");
    expect(czRequests(2)).toBe("2 žádosti");
    expect(czRequests(5)).toBe("5 žádostí");
  });
});

describe("czDays", () => {
  it("skloňuje podle počtu", () => {
    expect(czDays(1)).toBe("1 den");
    expect(czDays(3)).toBe("3 dny");
    expect(czDays(5)).toBe("5 dní");
  });
});

describe("carryoverExpiryWarning", () => {
  it("sloveso se shoduje s počtem dní", () => {
    expect(carryoverExpiryWarning(1, "31. 3. 2027")).toBe("Z loňska vám ještě zbývá 1 den dovolené a 31. 3. 2027 propadne. Naplánujte si je radši teď, ať o ně nepřijdete.");
    expect(carryoverExpiryWarning(3, "31. 3. 2027")).toBe("Z loňska vám ještě zbývá 3 dny dovolené a 31. 3. 2027 propadnou. Naplánujte si je radši teď, ať o ně nepřijdete.");
    expect(carryoverExpiryWarning(5, "31. 3. 2027")).toBe("Z loňska vám ještě zbývá 5 dní dovolené a 31. 3. 2027 propadne. Naplánujte si je radši teď, ať o ně nepřijdete.");
  });
});

describe("weeklyDigestIntro", () => {
  it("ukázka z e-mailu: 5 lidí a 2 žádosti → „chybí 5 lidí a čekají na vás 2 žádosti“", () => {
    expect(weeklyDigestIntro(5, 2)).toBe("tady je váš týdenní přehled — tento týden chybí 5 lidí a čekají na vás 2 žádosti ke schválení.");
  });

  it("sloveso se shoduje s počtem u chybějících i čekajících", () => {
    expect(weeklyDigestIntro(1, 1)).toBe("tady je váš týdenní přehled — tento týden chybí 1 člověk a čeká na vás 1 žádost ke schválení.");
    expect(weeklyDigestIntro(3, 4)).toBe("tady je váš týdenní přehled — tento týden chybějí 3 lidé a čekají na vás 4 žádosti ke schválení.");
    expect(weeklyDigestIntro(12, 5)).toBe("tady je váš týdenní přehled — tento týden chybí 12 lidí a čeká na vás 5 žádostí ke schválení.");
  });

  it("bez čekajících žádostí se druhá část vynechá", () => {
    expect(weeklyDigestIntro(2, 0)).toBe("tady je váš týdenní přehled — tento týden chybějí 2 lidé.");
  });

  it("když nikdo nechybí, věta zůstává jako dřív", () => {
    expect(weeklyDigestIntro(0, 3)).toBe("tady je váš týdenní přehled — tento týden nikdo nechybí.");
  });
});
