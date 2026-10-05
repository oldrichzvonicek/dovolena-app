import { describe, expect, it } from "vitest";
import { extendPaidUntil, isOverdue, monthlyRevenue, nextInvoiceNumber } from "./billing";

describe("monthlyRevenue", () => {
  it("Free je zdarma", () => {
    expect(monthlyRevenue({ plan: "free", addons: [], billingPeriod: "monthly", users: 4 })).toBe(0);
  });

  it("Starter (klíč basic) měsíčně stojí 290 Kč", () => {
    expect(monthlyRevenue({ plan: "basic", addons: [], billingPeriod: "monthly", users: 8 })).toBe(290);
  });

  it("roční platba se dělí dvanácti", () => {
    expect(monthlyRevenue({ plan: "basic", addons: [], billingPeriod: "yearly", users: 8 })).toBe(Math.round(2900 / 12));
  });

  it("Pro účtuje uživatele nad 30 zahrnutých", () => {
    expect(monthlyRevenue({ plan: "pro", addons: [], billingPeriod: "monthly", users: 30 })).toBe(1190);
    expect(monthlyRevenue({ plan: "pro", addons: [], billingPeriod: "monthly", users: 40 })).toBe(1190 + 10 * 39);
  });

  it("doplněk, který je v tarifu v ceně, se nepřičítá", () => {
    expect(monthlyRevenue({ plan: "pro", addons: ["hr_insights"], billingPeriod: "monthly", users: 10 })).toBe(1190);
    expect(monthlyRevenue({ plan: "starter", addons: ["hr_insights"], billingPeriod: "monthly", users: 10 })).toBe(590 + 200);
  });

  it("sleva se počítá z celku", () => {
    expect(monthlyRevenue({ plan: "starter", addons: [], billingPeriod: "monthly", users: 10, discountPct: 10 })).toBe(531);
  });

  it("neznámý tarif se bere jako Free", () => {
    expect(monthlyRevenue({ plan: "něco", addons: null, billingPeriod: null, users: 3 })).toBe(0);
  });
});

describe("extendPaidUntil", () => {
  it("bez platnosti začíná dnes: měsíc končí den před stejným dnem příštího měsíce", () => {
    expect(extendPaidUntil(null, "2026-09-28", "monthly")).toBe("2026-10-27");
  });

  it("propadlá platnost začíná dnes", () => {
    expect(extendPaidUntil("2026-08-31", "2026-09-28", "monthly")).toBe("2026-10-27");
  });

  it("trvající platnost se prodlužuje od dne po jejím konci", () => {
    expect(extendPaidUntil("2026-10-27", "2026-10-01", "monthly")).toBe("2026-11-27");
  });

  it("roční období", () => {
    expect(extendPaidUntil("2026-12-31", "2026-12-01", "yearly")).toBe("2027-12-31");
  });
});

describe("nextInvoiceNumber", () => {
  it("první faktura roku", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("20260001");
  });

  it("pokračuje za nejvyšším číslem stejného roku a ignoruje cizí tvary", () => {
    expect(nextInvoiceNumber(["20260001", "20260007", "20250099", "FV-12", ""], 2026)).toBe("20260008");
  });
});

describe("isOverdue", () => {
  it("jen vystavená faktura po splatnosti", () => {
    expect(isOverdue({ status: "issued", due_at: "2026-09-01" }, "2026-09-28")).toBe(true);
    expect(isOverdue({ status: "paid", due_at: "2026-09-01" }, "2026-09-28")).toBe(false);
    expect(isOverdue({ status: "issued", due_at: "2026-09-28" }, "2026-09-28")).toBe(false);
    expect(isOverdue({ status: "issued", due_at: null }, "2026-09-28")).toBe(false);
  });
});
