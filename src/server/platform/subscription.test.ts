import { describe, expect, it } from "vitest";
import { planSubscriptionChange, type SubscriptionState } from "./subscription";

const TODAY = "2026-09-28";
const base: SubscriptionState = { plan: "starter", addons: [], billing_period: "monthly", plan_paid_until: "2026-10-15", pending_plan: null, pending_plan_from: null, discount_pct: 0 };

const ok = (r: ReturnType<typeof planSubscriptionChange>) => {
  if ("error" in r) throw new Error(r.error);
  return r;
};

describe("planSubscriptionChange", () => {
  it("zvýšení tarifu platí hned a smaže naplánované snížení", () => {
    const r = ok(planSubscriptionChange({ ...base, pending_plan: "free", pending_plan_from: "2026-10-16" }, { plan: "pro" }, TODAY));
    expect(r.kind).toBe("upgrade");
    expect(r.scheduled).toBe(false);
    expect(r.update.plan).toBe("pro");
    expect(r.update.pending_plan).toBeNull();
    expect(r.changes.plan).toEqual({ from: "starter", to: "pro" });
  });

  it("snížení tarifu se naplánuje na den po platnosti a tarif zůstává", () => {
    const r = ok(planSubscriptionChange(base, { plan: "basic" }, TODAY));
    expect(r.kind).toBe("downgrade");
    expect(r.scheduled).toBe(true);
    expect(r.scheduledFrom).toBe("2026-10-16");
    expect(r.update.plan).toBe("starter");
    expect(r.update.pending_plan).toBe("basic");
    expect(r.update.pending_plan_from).toBe("2026-10-16");
  });

  it("snížení hned je možné jako výjimka", () => {
    const r = ok(planSubscriptionChange(base, { plan: "basic", immediate: true }, TODAY));
    expect(r.scheduled).toBe(false);
    expect(r.update.plan).toBe("basic");
    expect(r.update.pending_plan).toBeNull();
  });

  it("bez zaplaceného období se snížení provede hned", () => {
    const r = ok(planSubscriptionChange({ ...base, plan_paid_until: null }, { plan: "free" }, TODAY));
    expect(r.scheduled).toBe(false);
    expect(r.update.plan).toBe("free");
  });

  it("změna jen platnosti a slevy nemění tarif", () => {
    const r = ok(planSubscriptionChange(base, { plan_paid_until: "2026-11-15", discount_pct: 15 }, TODAY));
    expect(r.kind).toBe("same");
    expect(r.update.plan).toBe("starter");
    expect(Object.keys(r.changes).sort()).toEqual(["discount_pct", "plan_paid_until"]);
  });

  it("zrušení naplánované změny", () => {
    const r = ok(planSubscriptionChange({ ...base, pending_plan: "basic", pending_plan_from: "2026-10-16" }, { cancel_pending: true }, TODAY));
    expect(r.update.pending_plan).toBeNull();
    expect(r.changes.pending_plan).toEqual({ from: "basic", to: null });
  });

  it("odmítne neznámý tarif, doplněk, období, datum i slevu", () => {
    expect(planSubscriptionChange(base, { plan: "gold" }, TODAY)).toHaveProperty("error");
    expect(planSubscriptionChange(base, { addons: ["magie"] }, TODAY)).toHaveProperty("error");
    expect(planSubscriptionChange(base, { billing_period: "weekly" }, TODAY)).toHaveProperty("error");
    expect(planSubscriptionChange(base, { plan_paid_until: "2026-02-31" }, TODAY)).toHaveProperty("error");
    expect(planSubscriptionChange(base, { discount_pct: 120 }, TODAY)).toHaveProperty("error");
  });

  it("platnost jde vymazat", () => {
    const r = ok(planSubscriptionChange(base, { plan_paid_until: null }, TODAY));
    expect(r.update.plan_paid_until).toBeNull();
  });

  it("zastaralý tarif enterprise se bere jako pro", () => {
    const r = ok(planSubscriptionChange({ ...base, plan: "enterprise" }, { plan: "pro" }, TODAY));
    expect(r.kind).toBe("same");
  });
});
