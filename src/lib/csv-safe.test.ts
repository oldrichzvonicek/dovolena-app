import { describe, expect, it } from "vitest";
import { safeCell } from "./csv";

describe("safeCell (CSV / spreadsheet formula injection)", () => {
  it("neutralises formula starters", () => {
    for (const v of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\t=x", "\r=x"]) expect(safeCell(v).startsWith("'")).toBe(true);
  });
  it("leaves normal names alone", () => {
    expect(safeCell("Jana Nováková")).toBe("Jana Nováková");
    expect(safeCell("O'Brien")).toBe("O'Brien");
  });
});
