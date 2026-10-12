import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retryDelayMinutes, senderFor, sendEmail, sendEmailBatch } from "./email";

describe("retryDelayMinutes", () => {
  it("první opakování hned příště, pak čím dál delší odstup", () => {
    expect([1, 2, 3, 4].map(retryDelayMinutes)).toEqual([3, 15, 60, 240]);
    expect(retryDelayMinutes(9)).toBe(240);
  });
});

describe("senderFor", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  it("fakturace má vlastního odesílatele, jen když je nastavený", () => {
    process.env.EMAIL_FROM = "Dodio <info@dodio.cz>";
    delete process.env.EMAIL_FROM_BILLING;
    expect(senderFor("billing")).toBe("Dodio <info@dodio.cz>");
    process.env.EMAIL_FROM_BILLING = "Dodio fakturace <fakturace@dodio.cz>";
    expect(senderFor("billing")).toBe("Dodio fakturace <fakturace@dodio.cz>");
    expect(senderFor("weekly_digest")).toBe("Dodio <info@dodio.cz>");
  });
});

describe("odesílání", () => {
  const env = { ...process.env };
  const calls: { url: string; init: RequestInit }[] = [];
  beforeEach(() => {
    calls.length = 0;
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Dodio <info@dodio.cz>";
    process.env.EMAIL_REPLY_TO = "podpora@dodio.cz";
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });
  const stub = (respond: (url: string, n: number) => Response) =>
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, calls.length);
    });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("jeden e-mail nese Idempotency-Key, Reply-To a vrací id", async () => {
    stub(() => json({ id: "r1" }));
    const r = await sendEmail("a@b.cz", "Předmět", "Text", undefined, { idempotencyKey: "k1" });
    expect(r).toEqual({ ok: true, id: "r1" });
    const h = calls[0].init.headers as Record<string, string>;
    expect(h["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(calls[0].init.body as string).reply_to).toBe("podpora@dodio.cz");
  });

  it("dávka jde jedním požadavkem a vrací id v pořadí; .invalid se přeskočí", async () => {
    stub(() => json({ data: [{ id: "r1" }, { id: "r2" }] }));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "demo@firma.invalid", subject: "2", body: "x" },
      { to: "c@d.cz", subject: "3", body: "x" },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/emails/batch");
    expect(r.map((x) => x.id ?? (x.skipped ? "skip" : "?"))).toEqual(["r1", "skip", "r2"]);
  });

  it("při 4xx na dávku se posílá po jedné, ať selže jen vadná zpráva", async () => {
    stub((url, n) => (url.endsWith("/batch") ? json({ message: "bad" }, 422) : n === 3 ? json({ message: "bad address" }, 422) : json({ id: "ok" })));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "vadna", subject: "2", body: "x" },
    ]);
    expect(r.map((x) => x.ok)).toEqual([true, false]);
    expect(r[1].rejected).toBe(true);
  });

  it("při 5xx na dávku se nic neposílá znovu po jedné (mohla projít)", async () => {
    stub(() => json({ message: "boom" }, 503));
    const r = await sendEmailBatch([
      { to: "a@b.cz", subject: "1", body: "x" },
      { to: "c@d.cz", subject: "2", body: "x" },
    ]);
    expect(calls).toHaveLength(1);
    expect(r.every((x) => !x.ok && !x.rejected)).toBe(true);
  });
});
