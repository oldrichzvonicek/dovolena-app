import { describe, expect, it } from "vitest";
import { signInviteToken, verifyInviteToken } from "./invite-token";

const KEY = "test-secret-key";
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);

describe("invite token", () => {
  it("round-trips the e-mail and normalizes case/whitespace", () => {
    const t = signInviteToken("  Jana.Novakova@Firma.cz  ", 14, NOW, KEY);
    expect(verifyInviteToken(t, NOW + 1000, KEY)).toBe("jana.novakova@firma.cz");
  });

  it("expires after the given number of days", () => {
    const t = signInviteToken("jana@firma.cz", 14, NOW, KEY);
    expect(verifyInviteToken(t, NOW + 13 * 86400 * 1000, KEY)).not.toBeNull();
    expect(verifyInviteToken(t, NOW + 15 * 86400 * 1000, KEY)).toBeNull();
  });

  it("rejects a token signed with another key or with a tampered payload", () => {
    const t = signInviteToken("jana@firma.cz", 14, NOW, KEY);
    expect(verifyInviteToken(t, NOW, "other-key")).toBeNull();

    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ e: "utocnik@firma.cz", exp: Math.floor(NOW / 1000) + 999999 })).toString("base64url");
    expect(verifyInviteToken(`${forged}.${sig}`, NOW, KEY)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "not.base64!!"]) expect(verifyInviteToken(bad, NOW, KEY)).toBeNull();
  });
});
