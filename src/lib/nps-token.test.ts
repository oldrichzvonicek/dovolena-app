import { describe, expect, it } from "vitest";
import { newNpsToken, signNpsToken, verifyNpsToken } from "./nps-token";

const KEY = "test-secret-key";
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);

describe("nps token", () => {
  it("round-trips company and profile ids", () => {
    const t = newNpsToken("co-1", "admin-1", 30, NOW, KEY);
    expect(verifyNpsToken(t, NOW + 1000, KEY)).toMatchObject({ c: "co-1", p: "admin-1" });
  });

  it("expires", () => {
    const t = newNpsToken("co-1", "admin-1", 30, NOW, KEY);
    expect(verifyNpsToken(t, NOW + 29 * 86400 * 1000, KEY)).not.toBeNull();
    expect(verifyNpsToken(t, NOW + 31 * 86400 * 1000, KEY)).toBeNull();
  });

  it("rejects a token signed with another key or with a tampered payload", () => {
    const t = newNpsToken("co-1", "admin-1", 30, NOW, KEY);
    expect(verifyNpsToken(t, NOW, "other-key")).toBeNull();

    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ c: "co-2", p: "admin-1", exp: Math.floor(NOW / 1000) + 999999 })).toString("base64url");
    expect(verifyNpsToken(`${forged}.${sig}`, NOW, KEY)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "not.base64!!"]) expect(verifyNpsToken(bad, NOW, KEY)).toBeNull();
    const noExp = signNpsToken({ c: "x", p: "y" } as never, KEY);
    expect(verifyNpsToken(noExp, NOW, KEY)).toBeNull();
  });
});
