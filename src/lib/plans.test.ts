import { describe, expect, it } from "vitest";
import { PLANS, planByKey, planPrice, recommendedFor } from "./plans";

const plan = (k: string) => PLANS.find((p) => p.key === k)!;

describe("plans", () => {
  it("has the agreed fixed prices", () => {
    expect(planPrice(plan("free"), 3, "monthly")).toBe(0);
    expect(planPrice(plan("starter"), 10, "monthly")).toBe(590);
    expect(planPrice(plan("starter"), 10, "yearly")).toBe(5900);
    expect(planPrice(plan("pro"), 25, "monthly")).toBe(1190);
    expect(planPrice(plan("pro"), 25, "yearly")).toBe(11900);
  });

  it("bills enterprise per user above 30", () => {
    expect(planPrice(plan("enterprise"), 30, "monthly")).toBe(1190);
    expect(planPrice(plan("enterprise"), 32, "monthly")).toBe(1190 + 2 * 39);
    expect(planPrice(plan("enterprise"), 40, "yearly")).toBe(11900 + 10 * 390);
  });

  it("recommends the cheapest plan that fits", () => {
    expect(recommendedFor(4).key).toBe("free");
    expect(recommendedFor(15).key).toBe("starter");
    expect(recommendedFor(30).key).toBe("pro");
    expect(recommendedFor(31).key).toBe("enterprise");
  });

  it("falls back to Free for unknown / legacy plan keys", () => {
    expect(planByKey("start").key).toBe("free");
    expect(planByKey(undefined).key).toBe("free");
  });
});
