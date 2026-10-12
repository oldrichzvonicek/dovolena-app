import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { interpretEvent, verifyResendWebhook } from "./resend-webhook";

const KEY = Buffer.from("super-tajny-klic-pro-test");
const secret = `whsec_${KEY.toString("base64")}`;
const sign = (id: string, ts: string, body: string) => `v1,${createHmac("sha256", KEY).update(`${id}.${ts}.${body}`).digest("base64")}`;
const NOW = 1_800_000_000;

describe("verifyResendWebhook", () => {
  const body = '{"type":"email.delivered"}';
  const ts = String(NOW);
  const good = { secret, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), body, now: NOW };

  it("platný podpis projde", () => {
    expect(verifyResendWebhook(good)).toBe(true);
  });
  it("projde i při více podpisech v hlavičce (rotace klíče)", () => {
    expect(verifyResendWebhook({ ...good, signature: `v1,AAAA ${good.signature}` })).toBe(true);
  });
  it("změněné tělo, cizí podpis nebo chybějící hlavičky neprojdou", () => {
    expect(verifyResendWebhook({ ...good, body: '{"type":"email.bounced"}' })).toBe(false);
    expect(verifyResendWebhook({ ...good, signature: "v1,AAAA" })).toBe(false);
    expect(verifyResendWebhook({ ...good, id: null })).toBe(false);
  });
  it("starý nebo budoucí časový údaj neprojde (replay)", () => {
    expect(verifyResendWebhook({ ...good, now: NOW + 10 * 60 })).toBe(false);
    expect(verifyResendWebhook({ ...good, now: NOW - 10 * 60 })).toBe(false);
  });
});

describe("interpretEvent", () => {
  it("trvalý bounce potlačí adresu, dočasný ne", () => {
    const perm = interpretEvent({ type: "email.bounced", data: { email_id: "e1", to: ["Jana@Firma.cz"], bounce: { type: "Permanent" } } });
    expect(perm).toMatchObject({ status: "bounced", suppress: "bounced", to: ["jana@firma.cz"] });
    const temp = interpretEvent({ type: "email.bounced", data: { email_id: "e1", to: ["a@b.cz"], bounce: { type: "Transient" } } });
    expect(temp).toMatchObject({ status: "bounced", suppress: null });
  });
  it("stížnost na spam potlačí adresu", () => {
    expect(interpretEvent({ type: "email.complained", data: { email_id: "e1", to: ["a@b.cz"] } })).toMatchObject({ status: "complained", suppress: "complained" });
  });
  it("doručení nic nepotlačuje; ostatní události a události bez id se ignorují", () => {
    expect(interpretEvent({ type: "email.delivered", data: { email_id: "e1", to: ["a@b.cz"] } })).toMatchObject({ status: "delivered", suppress: null });
    expect(interpretEvent({ type: "email.opened", data: { email_id: "e1" } })).toBeNull();
    expect(interpretEvent({ type: "email.delivered", data: {} })).toBeNull();
  });
});
