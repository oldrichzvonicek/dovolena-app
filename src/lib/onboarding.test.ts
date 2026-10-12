import { describe, expect, it } from "vitest";
import { planOnboarding, shouldSend } from "./onboarding";

const none = new Set<string>();

describe("planOnboarding", () => {
  it("první den admin nic nedostane, druhý den pozvání kolegů", () => {
    expect(planOnboarding(1, "admin", none).send).toBeNull();
    expect(planOnboarding(2, "admin", none).send?.key).toBe("invite");
  });
  it("už poslaný krok se neopakuje", () => {
    expect(planOnboarding(3, "admin", new Set(["invite"])).send).toBeNull();
    expect(planOnboarding(4, "admin", new Set(["invite"])).send?.key).toBe("rules");
  });
  it("po výpadku se pošle jen poslední splatný krok, starší se přeskočí", () => {
    const p = planOnboarding(8, "admin", none);
    expect(p.send?.key).toBe("approval");
    expect(p.skip.map((s) => s.key)).toEqual(["invite", "rules"]);
  });
  it("příliš starý krok se neposílá vůbec", () => {
    const p = planOnboarding(30, "admin", new Set(["invite", "rules", "approval", "calendar"]));
    expect(p.send).toBeNull();
    expect(p.skip.map((s) => s.key)).toEqual(["export"]);
  });
  it("zaměstnanec má vlastní dvě zprávy", () => {
    expect(planOnboarding(1, "employee", none).send?.key).toBe("emp_start");
    expect(planOnboarding(7, "employee", new Set(["emp_start"])).send?.key).toBe("emp_plan");
  });
});

describe("shouldSend", () => {
  const facts = { activePeople: 1, hasBlackout: false, customVacationDays: false, hasIntegration: false };
  const step = (key: string) => ({ key, day: 1, track: "admin" as const, template: "x" });
  it("pozvání jen když firma má méně než 3 lidi", () => {
    expect(shouldSend(step("invite"), facts)).toBe(true);
    expect(shouldSend(step("invite"), { ...facts, activePeople: 5 })).toBe(false);
  });
  it("pravidla se nepřipomínají, když už je blokovaný termín nebo vlastní nárok", () => {
    expect(shouldSend(step("rules"), { ...facts, hasBlackout: true })).toBe(false);
    expect(shouldSend(step("rules"), { ...facts, customVacationDays: true })).toBe(false);
  });
  it("schvalování a kalendář dávají smysl až s dalšími lidmi", () => {
    expect(shouldSend(step("approval"), facts)).toBe(false);
    expect(shouldSend(step("approval"), { ...facts, activePeople: 2 })).toBe(true);
    expect(shouldSend(step("calendar"), { ...facts, activePeople: 2 })).toBe(false);
    expect(shouldSend(step("calendar"), { ...facts, activePeople: 3 })).toBe(true);
  });
  it("integrace jen tomu, kdo ji ještě nemá", () => {
    expect(shouldSend(step("export"), { ...facts, hasIntegration: true })).toBe(false);
  });
});
