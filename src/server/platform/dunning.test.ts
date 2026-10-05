import { describe, expect, it } from "vitest";
import { daysOverdue, nextDunningStep } from "./dunning";

describe("upomínky", () => {
  it("daysOverdue počítá celé dny po splatnosti", () => {
    expect(daysOverdue("2026-09-01", "2026-09-04")).toBe(3);
    expect(daysOverdue("2026-09-28", "2026-09-28")).toBe(0);
  });

  it("před 3. dnem se nic neposílá", () => {
    expect(nextDunningStep(0, new Set())).toBeNull();
    expect(nextDunningStep(2, new Set())).toBeNull();
  });

  it("kroky přicházejí po 3, 7, 14 a 21 dnech", () => {
    expect(nextDunningStep(3, new Set())).toBe("reminder_1");
    expect(nextDunningStep(7, new Set(["reminder_1"]))).toBe("reminder_2");
    expect(nextDunningStep(14, new Set(["reminder_1", "reminder_2"]))).toBe("reminder_3");
    expect(nextDunningStep(21, new Set(["reminder_1", "reminder_2", "reminder_3"]))).toBe("suspend");
  });

  it("už provedený krok se neopakuje", () => {
    expect(nextDunningStep(4, new Set(["reminder_1"]))).toBeNull();
    expect(nextDunningStep(30, new Set(["suspend"]))).toBeNull();
  });

  it("při dlouhém prodlení se pošle jen nejvyšší chybějící krok, ne všechny naráz", () => {
    expect(nextDunningStep(15, new Set())).toBe("reminder_3");
    expect(nextDunningStep(40, new Set())).toBe("suspend");
  });
});
