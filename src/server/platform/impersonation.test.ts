import { describe, expect, it } from "vitest";
import { isActive, isMinutes, isSensitiveType } from "./impersonation";

describe("náhled firmy (impersonace)", () => {
  it("relace je aktivní jen před vypršením a bez ukončení", () => {
    const now = Date.parse("2026-09-28T10:00:00Z");
    expect(isActive({ expires_at: "2026-09-28T10:15:00Z", ended_at: null }, now)).toBe(true);
    expect(isActive({ expires_at: "2026-09-28T09:59:59Z", ended_at: null }, now)).toBe(false);
    expect(isActive({ expires_at: "2026-09-28T10:15:00Z", ended_at: "2026-09-28T10:05:00Z" }, now)).toBe(false);
  });

  it("délka je jen 15, 30 nebo 60 minut", () => {
    expect(isMinutes(15)).toBe(true);
    expect(isMinutes(60)).toBe(true);
    expect(isMinutes(45)).toBe(false);
    expect(isMinutes("30")).toBe(false);
  });

  it("nemoc a skryté typy se maskují, dovolená ne", () => {
    expect(isSensitiveType({ counts_against: "sick" })).toBe(true);
    expect(isSensitiveType({ key: "sick", counts_against: "none" })).toBe(true);
    expect(isSensitiveType({ hide_from_colleagues: true, counts_against: "none" })).toBe(true);
    expect(isSensitiveType({ key: "dovolena", counts_against: "vacation", hide_from_colleagues: false })).toBe(false);
  });
});
