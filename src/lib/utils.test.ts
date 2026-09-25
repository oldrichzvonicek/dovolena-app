import { describe, expect, it } from "vitest";
import { formatNumber } from "./utils";
import { reducesPresence } from "./leave-kinds";
import { countWorkingDays, dayWord } from "./working-days";

describe("formatNumber", () => {
  it("uses a decimal comma and drops trailing zeros", () => {
    expect(formatNumber(10.5)).toBe("10,5");
    expect(formatNumber(12)).toBe("12");
  });
});

describe("dayWord", () => {
  it("declines Czech day forms", () => {
    expect(dayWord(1)).toBe("den");
    expect(dayWord(3)).toBe("dny");
    expect(dayWord(5)).toBe("dní");
    expect(dayWord(0.5)).toBe("dne");
  });
});

describe("countWorkingDays", () => {
  it("skips weekends and Czech public holidays", () => {
    expect(countWorkingDays("2026-09-21", "2026-09-27")).toBe(5);
    // 28. 9. 2026 (Den české státnosti) is a Monday holiday
    expect(countWorkingDays("2026-09-28", "2026-09-30")).toBe(2);
  });

  it("is 0 for a weekend only", () => {
    expect(countWorkingDays("2026-09-26", "2026-09-27")).toBe(0);
  });
});

describe("reducesPresence", () => {
  it("does not treat home office as an absence", () => {
    expect(reducesPresence("home_office")).toBe(false);
    expect(reducesPresence("dovolena")).toBe(true);
  });
});
