import { describe, expect, it } from "vitest";
import { pendingPhrase, planReengagement, reengageKey } from "./reengagement";

const at = (d: string) => new Date(`${d}T09:00:00Z`);

describe("planReengagement", () => {
  const last = "2026-10-01T08:00:00Z";
  it("před 14 dny nic, po 14 dnech první, po 30 druhý, po 60 nic", () => {
    expect(planReengagement(last, at("2026-10-14"), new Set())).toBeNull();
    expect(planReengagement(last, at("2026-10-15"), new Set())?.step).toBe("reengage_14");
    expect(planReengagement(last, at("2026-10-31"), new Set())?.step).toBe("reengage_30");
    expect(planReengagement(last, at("2026-12-01"), new Set())).toBeNull();
  });
  it("odeslaný krok se neopakuje, ale nová aktivita začíná znovu", () => {
    const done = new Set([reengageKey("reengage_14", "2026-10-01")]);
    expect(planReengagement(last, at("2026-10-16"), done)).toBeNull();
    expect(planReengagement("2026-10-20T10:00:00Z", at("2026-11-04"), done)?.key).toBe("reengage_14:2026-10-20");
  });
});

describe("pendingPhrase", () => {
  it("skloňuje a při nule mlčí", () => {
    expect([0, 1, 3, 7].map(pendingPhrase)).toEqual(["", "1 žádost ke schválení", "3 žádosti ke schválení", "7 žádostí ke schválení"]);
  });
});
