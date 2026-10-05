import { describe, expect, it } from "vitest";
import { currentRows, effectiveRow, previewPriceChange, validatePriceInput, type PlanPriceRow, type PreviewCompany } from "./prices";

const row = (over: Partial<PlanPriceRow>): PlanPriceRow => ({ id: "r1", code: "starter", name: "Team", user_limit: 15, included_users: null, price_monthly: 590, price_yearly: 5900, price_extra_user_monthly: null, price_extra_user_yearly: null, valid_from: "2026-01-01", ...over });
const co = (over: Partial<PreviewCompany>): PreviewCompany => ({ id: "c", plan: "starter", addons: [], billing_period: "monthly", users: 8, discount_pct: 0, is_test: false, status: "active", locked_plan_id: null, ...over });

describe("ceník", () => {
  it("currentRows vybere nejnovější řádek platný dnes, budoucí ignoruje", () => {
    const rows = [row({ id: "a", valid_from: "2026-01-01" }), row({ id: "b", valid_from: "2026-06-01", price_monthly: 690 }), row({ id: "c", valid_from: "2027-01-01", price_monthly: 790 })];
    expect(currentRows(rows, "2026-09-28").get("starter")?.id).toBe("b");
    expect(currentRows(rows, "2025-01-01").size).toBe(0);
  });

  it("firma se zamčenou cenou platí zamčený řádek, ostatní aktuální", () => {
    const a = row({ id: "a" });
    const b = row({ id: "b", valid_from: "2026-06-01", price_monthly: 690 });
    const byId = new Map([["a", a], ["b", b]]);
    const current = new Map([["starter", b]]);
    expect(effectiveRow({ plan: "starter", locked_plan_id: "a" }, byId, current)?.id).toBe("a");
    expect(effectiveRow({ plan: "starter", locked_plan_id: null }, byId, current)?.id).toBe("b");
    expect(effectiveRow({ plan: "enterprise", locked_plan_id: null }, byId, new Map([["pro", row({ id: "p", code: "pro" })]]))?.id).toBe("p");
  });

  it("all_after_notice: dopad na MRR jen firem bez zámku", () => {
    const companies = [co({ id: "1" }), co({ id: "2" }), co({ id: "3", locked_plan_id: "old" }), co({ id: "4", is_test: true }), co({ id: "5", plan: "pro" })];
    const p = previewPriceChange(companies, "starter", row({}), { price_monthly: 690, price_yearly: 6900, price_extra_user_monthly: null, price_extra_user_yearly: null }, "all_after_notice", "2026-09-28");
    expect(p.locked).toBe(2);
    expect(p.affected).toBe(2);
    expect(p.mrrBefore).toBe(1180);
    expect(p.mrrAfter).toBe(1380);
    expect(p.delta).toBe(200);
    expect(p.effectiveFrom).toBe("2026-10-28");
  });

  it("new_only: stávající firmy se cena nedotkne", () => {
    const p = previewPriceChange([co({ id: "1" })], "starter", row({}), { price_monthly: 990, price_yearly: 9900, price_extra_user_monthly: null, price_extra_user_yearly: null }, "new_only", "2026-09-28");
    expect(p.affected).toBe(0);
    expect(p.delta).toBe(0);
    expect(p.effectiveFrom).toBe("2026-09-28");
  });

  it("pozastavené firmy se do MRR nepočítají", () => {
    const p = previewPriceChange([co({ status: "suspended" })], "starter", row({}), { price_monthly: 690, price_yearly: 6900, price_extra_user_monthly: null, price_extra_user_yearly: null }, "all_after_notice", "2026-09-28");
    expect(p.mrrBefore).toBe(0);
    expect(p.affected).toBe(0);
  });

  it("validatePriceInput přijme čísla s čárkou a odmítne záporná", () => {
    expect(validatePriceInput({ price_monthly: "290,5", price_yearly: 2900 })).toMatchObject({ price_monthly: 290.5, price_yearly: 2900, price_extra_user_monthly: null });
    expect(validatePriceInput({ price_monthly: -1, price_yearly: 10 })).toHaveProperty("error");
    expect(validatePriceInput({ price_monthly: "abc", price_yearly: 10 })).toHaveProperty("error");
    expect(validatePriceInput({ price_monthly: 10 })).toHaveProperty("error");
  });
});
