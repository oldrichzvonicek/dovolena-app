import { describe, expect, it } from "vitest";
import { buildInvoicePayload, fakturoidConfig, isValidWebhookAuth, parseInvoice, webhookToken } from "./fakturoid";
import { monthlyRevenue, periodAmount } from "./billing";
import { isDailySlot } from "./autobilling";

const cfg = { slug: "dodio", clientId: "id", clientSecret: "tajne" };

describe("fakturoidConfig", () => {
  it("bez všech tří proměnných je integrace vypnutá", () => {
    expect(fakturoidConfig({})).toBeNull();
    expect(fakturoidConfig({ FAKTUROID_ACCOUNT: "dodio", FAKTUROID_CLIENT_ID: "x" })).toBeNull();
    expect(fakturoidConfig({ FAKTUROID_ACCOUNT: " dodio ", FAKTUROID_CLIENT_ID: "id", FAKTUROID_CLIENT_SECRET: "s" })).toMatchObject({ slug: "dodio", clientId: "id", clientSecret: "s" });
    // alternativní název proměnné se slugem + volitelný kontakt a vlastní token webhooku
    const c = fakturoidConfig({ FAKTUROID_SLUG: "vinylgarden", FAKTUROID_CLIENT_ID: "id", FAKTUROID_CLIENT_SECRET: "s", FAKTUROID_CONTACT_EMAIL: "a@b.cz", FAKTUROID_WEBHOOK_TOKEN: "tok" });
    expect(c).toEqual({ slug: "vinylgarden", clientId: "id", clientSecret: "s", contactEmail: "a@b.cz", webhookToken: "tok" });
    expect(webhookToken(c!)).toBe("tok");
  });
});

describe("webhook Fakturoidu", () => {
  it("přijme jen správný token z client secretu", () => {
    expect(isValidWebhookAuth(`Bearer ${webhookToken(cfg)}`, cfg)).toBe(true);
    expect(isValidWebhookAuth("Bearer nesmysl", cfg)).toBe(false);
    expect(isValidWebhookAuth(null, cfg)).toBe(false);
    expect(webhookToken(cfg)).not.toBe(webhookToken({ ...cfg, clientSecret: "jine" }));
  });
});

describe("buildInvoicePayload", () => {
  const base = { subjectId: 7, customId: "c1:2026-11-01", name: "Dodio — tarif Pro", amount: 1190 };
  it("plátce DPH: cena z celku s DPH a sazba 21 %", () => {
    const p = buildInvoicePayload({ ...base, vatPayer: true });
    expect(p.vat_price_mode).toBe("from_total_with_vat");
    expect(p.lines[0]).toMatchObject({ unit_price: "1190", vat_rate: 21 });
    expect(p.payment_method).toBe("bank");
    expect(p.due).toBe(14);
  });
  it("neplátce: bez sazby DPH", () => {
    const p = buildInvoicePayload({ ...base, vatPayer: false });
    expect(p).not.toHaveProperty("vat_price_mode");
    expect(p.lines[0]).not.toHaveProperty("vat_rate");
  });
});

describe("parseInvoice", () => {
  it("vytáhne číslo, VS a DPH z odpovědi", () => {
    const i = parseInvoice({ id: 93, number: "2026-0056", variable_symbol: "20260056", issued_on: "2026-10-14", due_on: "2026-10-28", total: "1190.0", subtotal: "983.47", status: "open", custom_id: "c" });
    expect(i).toMatchObject({ id: 93, number: "2026-0056", variableSymbol: "20260056", total: 1190, vat: 206.53, dueOn: "2026-10-28" });
  });
});

describe("periodAmount", () => {
  it("cena za období odpovídá MRR u měsíční platby a ročnímu ceníku u roční", () => {
    const m = { plan: "pro", addons: [], billingPeriod: "monthly", users: 10 };
    expect(periodAmount(m)).toBe(monthlyRevenue(m));
    const y = periodAmount({ ...m, billingPeriod: "yearly" });
    expect(y).toBeGreaterThan(periodAmount(m) * 9);
  });
  it("sleva se počítá z celku a výsledek jsou celé koruny", () => {
    const a = periodAmount({ plan: "starter", addons: [], billingPeriod: "monthly", users: 5 });
    const b = periodAmount({ plan: "starter", addons: [], billingPeriod: "monthly", users: 5, discountPct: 50 });
    expect(Number.isInteger(b)).toBe(true);
    expect(b).toBe(Math.round(a * 0.5));
  });
});

describe("isDailySlot", () => {
  it("jednou denně v 9:00 pražského času (první pětiminutovka)", () => {
    expect(isDailySlot(new Date("2026-10-14T07:02:00Z"))).toBe(true); // 9:02 CEST
    expect(isDailySlot(new Date("2026-10-14T07:05:00Z"))).toBe(false);
    expect(isDailySlot(new Date("2026-10-14T06:58:00Z"))).toBe(false);
    expect(isDailySlot(new Date("2026-12-14T08:01:00Z"))).toBe(true); // 9:01 CET
  });
});
