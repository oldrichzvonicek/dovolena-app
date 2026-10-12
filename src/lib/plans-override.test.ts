import { describe, expect, it } from "vitest";
import { PLANS, applyPlanPrices, planByKey, planPrice } from "./plans";

// Tenhle soubor mění globální PLANS, proto je oddělený (každý testový soubor má vlastní kopii modulů).
describe("applyPlanPrices (ceník z databáze)", () => {
  it("přepíše ceny nejnovějším platným řádkem a ostatní tarify nechá", () => {
    const before = planByKey("free").monthly;
    applyPlanPrices(
      [
        { code: "basic", price_monthly: "290", price_yearly: "2900", price_extra_user_monthly: null, price_extra_user_yearly: null, valid_from: "2026-01-01" },
        { code: "basic", price_monthly: "390", price_yearly: "3900", price_extra_user_monthly: null, price_extra_user_yearly: null, valid_from: "2026-06-01" },
        { code: "basic", price_monthly: "999", price_yearly: "9999", price_extra_user_monthly: null, price_extra_user_yearly: null, valid_from: "2027-01-01" },
      ],
      "2026-09-28"
    );
    expect(planByKey("basic").monthly).toBe(390);
    expect(planByKey("basic").yearly).toBe(3900);
    expect(planByKey("free").monthly).toBe(before);
  });

  it("cena za dalšího uživatele se přepíše jen u tarifu s zahrnutými uživateli (Pro)", () => {
    applyPlanPrices([{ code: "pro", price_monthly: 1290, price_yearly: 12900, price_extra_user_monthly: 49, price_extra_user_yearly: 490, valid_from: "2026-01-01" }], "2026-09-28");
    const pro = PLANS.find((p) => p.key === "pro")!;
    expect(pro.monthly).toBe(1290);
    expect(planPrice(pro, 40, "monthly")).toBe(1290 + 10 * 49);
  });

  it("řádky bez platnosti k dnešku se ignorují", () => {
    const before = planByKey("starter").monthly;
    applyPlanPrices([{ code: "starter", price_monthly: 1, price_yearly: 1, price_extra_user_monthly: null, price_extra_user_yearly: null, valid_from: "2099-01-01" }], "2026-09-28");
    expect(planByKey("starter").monthly).toBe(before);
  });
});
