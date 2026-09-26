import { describe, expect, it } from "vitest";
import { ADDONS, FEATURE_MATRIX, PLANS, hasFeature, minPlanFor, planByKey, planPrice, pricePerUser, recommendedFor, userLimitOf } from "./plans";

const plan = (k: string) => PLANS.find((p) => p.key === k)!;

describe("plans", () => {
  it("has the agreed fixed prices", () => {
    expect(planPrice(plan("free"), 3, "monthly")).toBe(0);
    expect(planPrice(plan("starter"), 10, "monthly")).toBe(590);
    expect(planPrice(plan("starter"), 10, "yearly")).toBe(5900);
    expect(planPrice(plan("pro"), 25, "monthly")).toBe(1190);
    expect(planPrice(plan("pro"), 25, "yearly")).toBe(11900);
  });

  it("Pro has no user cap: 30 users included, 39 Kč per additional user", () => {
    expect(planPrice(plan("basic"), 8, "monthly")).toBe(290);
    expect(planPrice(plan("pro"), 30, "monthly")).toBe(1190);
    expect(planPrice(plan("pro"), 32, "monthly")).toBe(1190 + 2 * 39);
    expect(planPrice(plan("pro"), 40, "yearly")).toBe(11900 + 10 * 390);
  });

  it("recommends the cheapest plan that fits", () => {
    expect(recommendedFor(4).key).toBe("free");
    expect(recommendedFor(8).key).toBe("basic");
    expect(recommendedFor(15).key).toBe("starter");
    expect(recommendedFor(16).key).toBe("pro");
    expect(recommendedFor(80).key).toBe("pro");
  });

  it("falls back to Free for unknown / legacy plan keys", () => {
    expect(planByKey("start").key).toBe("free");
    expect(planByKey(undefined).key).toBe("free");
    expect(planByKey("enterprise").key).toBe("pro");
  });
});

describe("add-ons", () => {
  it("prices HR Insights at 200 and Účetní at 100 per month", () => {
    expect(ADDONS.find((a) => a.key === "hr_insights")!.monthly).toBe(200);
    expect(ADDONS.find((a) => a.key === "accountant")!.monthly).toBe(100);
  });

  it("HR Insights: add-on for Free, Basic and Starter, included in Pro", () => {
    expect(hasFeature("basic", ["hr_insights"], "hr_insights")).toBe(true);
    expect(hasFeature("enterprise", [], "hr_insights")).toBe(true);
    expect(hasFeature("free", [], "hr_insights")).toBe(false);
    expect(hasFeature("starter", [], "hr_insights")).toBe(false);
    expect(hasFeature("free", ["hr_insights"], "hr_insights")).toBe(true);
    expect(hasFeature("starter", ["hr_insights"], "hr_insights")).toBe(true);
    expect(hasFeature("pro", [], "hr_insights")).toBe(true);
  });

  it("Účetní: paid add-on only on Free, included from Starter (basic)", () => {
    expect(hasFeature("free", [], "accountant")).toBe(false);
    expect(hasFeature("free", ["accountant"], "accountant")).toBe(true);
    expect(hasFeature("basic", [], "accountant")).toBe(true);
    expect(hasFeature("starter", [], "accountant")).toBe(true);
    expect(hasFeature("pro", null, "accountant")).toBe(true);
  });

  it("the comparison table agrees with hasFeature()", () => {
    const row = (label: string) => FEATURE_MATRIX.flatMap((g) => g.rows).find((r) => r.label.startsWith(label))!;
    const keys = ["free", "basic", "starter", "pro"];
    keys.forEach((k, i) => {
      expect(row("Role Účetní").values[i] === true || row("Role Účetní").values[i] === "addon").toBe(true);
      expect(row("Role Účetní").values[i] === true).toBe(hasFeature(k, [], "accountant"));
      expect(row("HR Insights").values[i] === true).toBe(hasFeature(k, [], "hr_insights"));
    });
  });

  it("shows price per user for fixed-limit plans", () => {
    expect(pricePerUser(plan("basic"))).toBe(29);
    expect(pricePerUser(plan("starter"))).toBe(39);
    expect(pricePerUser(plan("free"))).toBeNull();
    expect(pricePerUser(plan("pro"))).toBeNull();
  });

  it("an unknown plan behaves like Free", () => {
    expect(hasFeature("start", [], "accountant")).toBe(false);
    expect(hasFeature(undefined, undefined, "hr_insights")).toBe(false);
  });
});

describe("feature gating by plan", () => {
  const keys = ["free", "basic", "starter", "pro"];

  it("the comparison table agrees with hasFeature() for every row that names a feature", () => {
    for (const row of FEATURE_MATRIX.flatMap((g) => g.rows).filter((r) => r.feature)) {
      keys.forEach((k, i) => {
        const cell = row.values[i];
        // "addon" = bez doplňku není, s doplňkem je
        expect(hasFeature(k, [], row.feature!), `${row.label} @ ${k}`).toBe(cell === true);
        if (cell === "addon") expect(hasFeature(k, [row.feature!], row.feature!), `${row.label} + doplněk @ ${k}`).toBe(true);
      });
    }
  });

  it("plan-only features cannot be bought as add-ons and follow the minimum plan", () => {
    expect(hasFeature("free", ["exports"], "exports")).toBe(false);
    expect(hasFeature("basic", [], "exports")).toBe(true);
    expect(hasFeature("basic", [], "chat_integrations")).toBe(false);
    expect(hasFeature("starter", [], "chat_integrations")).toBe(true);
    expect(hasFeature("starter", [], "webhooks")).toBe(false);
    expect(hasFeature("starter", [], "audit_log")).toBe(true);
    expect(hasFeature("basic", [], "audit_log")).toBe(false);
    expect(hasFeature("starter", [], "seniority")).toBe(true);
    expect(hasFeature("basic", [], "seniority")).toBe(false);
    expect(hasFeature("enterprise", [], "escalation")).toBe(true);
    expect(hasFeature(undefined, [], "seniority")).toBe(false);
  });

  it("names the cheapest plan that unlocks a feature", () => {
    expect(minPlanFor("exports").name).toBe("Starter");
    expect(minPlanFor("chat_integrations").name).toBe("Team");
    expect(minPlanFor("audit_log").name).toBe("Team");
    expect(minPlanFor("seniority").name).toBe("Team");
    expect(minPlanFor("escalation").name).toBe("Pro");
    expect(minPlanFor("hr_insights").name).toBe("Pro");
    expect(minPlanFor("accountant").name).toBe("Starter");
  });

  it("knows each plan's user limit", () => {
    expect([userLimitOf("free"), userLimitOf("basic"), userLimitOf("starter"), userLimitOf("pro"), userLimitOf("enterprise")]).toEqual([5, 10, 15, null, null]);
  });
});
