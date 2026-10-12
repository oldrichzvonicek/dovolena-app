import { describe, expect, it } from "vitest";
import { canTransition, isCompanyStatus } from "./status";

describe("stavový automat firmy", () => {
  it("aktivní firmu jde pozastavit i naplánovat ke smazání", () => {
    expect(canTransition("active", "suspended")).toBe(true);
    expect(canTransition("active", "pending_deletion")).toBe(true);
  });

  it("pozastavenou firmu jde obnovit nebo naplánovat ke smazání", () => {
    expect(canTransition("suspended", "active")).toBe(true);
    expect(canTransition("suspended", "pending_deletion")).toBe(true);
  });

  it("firmu ke smazání jde obnovit, nebo definitivně smazat", () => {
    expect(canTransition("pending_deletion", "active")).toBe(true);
    expect(canTransition("pending_deletion", "deleted")).toBe(true);
  });

  it("smazaná firma je konečný stav a smazat jde jen přes ochrannou lhůtu", () => {
    for (const to of ["active", "suspended", "pending_deletion", "deleted"] as const) expect(canTransition("deleted", to)).toBe(false);
    expect(canTransition("active", "deleted")).toBe(false);
    expect(canTransition("suspended", "deleted")).toBe(false);
  });

  it("stejný stav není přechod", () => {
    expect(canTransition("active", "active")).toBe(false);
  });

  it("isCompanyStatus rozpozná jen známé stavy", () => {
    expect(isCompanyStatus("active")).toBe(true);
    expect(isCompanyStatus("trial")).toBe(false);
    expect(isCompanyStatus(null)).toBe(false);
  });
});
