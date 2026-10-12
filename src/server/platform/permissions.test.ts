import { describe, expect, it } from "vitest";
import { can, isPlatformRole, permissionsOf, type Permission } from "./permissions";

describe("matice oprávnění super-adminu", () => {
  it("super-admin smí všechno", () => {
    const all: Permission[] = ["company.read", "company.delete", "plan.change", "pricing.write", "team.manage", "audit.read", "billing.write"];
    for (const p of all) expect(can("super_admin", p)).toBe(true);
  });

  it("podpora čte a poznamenává, ale nemění tarif, nemaže ani nespravuje tým", () => {
    expect(can("support", "company.read")).toBe(true);
    expect(can("support", "notes.write")).toBe(true);
    expect(can("support", "company.impersonate")).toBe(true);
    expect(can("support", "audit.read")).toBe(true);
    expect(can("support", "billing.read")).toBe(true);
    expect(can("support", "billing.write")).toBe(false);
    expect(can("support", "plan.change")).toBe(false);
    expect(can("support", "company.delete")).toBe(false);
    expect(can("support", "team.manage")).toBe(false);
    expect(can("support", "pricing.write")).toBe(false);
  });

  it("fakturace vidí jen fakturační údaje a zapisuje platby", () => {
    expect(can("billing", "company.read_billing")).toBe(true);
    expect(can("billing", "billing.write")).toBe(true);
    expect(can("billing", "company.read")).toBe(false);
    expect(can("billing", "company.impersonate")).toBe(false);
    expect(can("billing", "audit.read")).toBe(false);
    expect(can("billing", "plan.change")).toBe(false);
    expect(can("billing", "gdpr.forward")).toBe(false);
  });

  it("neznámá nebo chybějící role nesmí nic (bezpečné na null)", () => {
    expect(can(null, "company.read")).toBe(false);
    expect(can(undefined, "company.read")).toBe(false);
    expect(can("hacker" as never, "company.read")).toBe(false);
  });

  it("isPlatformRole odmítne cizí hodnoty a role zákaznické aplikace", () => {
    expect(isPlatformRole("support")).toBe(true);
    expect(isPlatformRole("admin")).toBe(false);
    expect(isPlatformRole("hr")).toBe(false);
    expect(isPlatformRole(null)).toBe(false);
  });

  it("každá role má neprázdný seznam oprávnění", () => {
    for (const r of ["super_admin", "support", "billing"] as const) expect(permissionsOf(r).length).toBeGreaterThan(0);
  });
});
