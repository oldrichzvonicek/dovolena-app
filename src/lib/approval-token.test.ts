import { describe, expect, it } from "vitest";
import { newApprovalToken, signApprovalToken, verifyApprovalToken } from "./approval-token";

const KEY = "test-secret-key";
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);

describe("approval token", () => {
  it("round-trips request and approver ids", () => {
    const t = newApprovalToken("req-1", "boss-1", 7, NOW, KEY);
    expect(verifyApprovalToken(t, NOW + 1000, KEY)).toMatchObject({ r: "req-1", a: "boss-1" });
  });

  it("expires", () => {
    const t = newApprovalToken("req-1", "boss-1", 7, NOW, KEY);
    expect(verifyApprovalToken(t, NOW + 6 * 86400 * 1000, KEY)).not.toBeNull();
    expect(verifyApprovalToken(t, NOW + 8 * 86400 * 1000, KEY)).toBeNull();
  });

  it("rejects a token signed with another key or with a tampered payload", () => {
    const t = newApprovalToken("req-1", "boss-1", 7, NOW, KEY);
    expect(verifyApprovalToken(t, NOW, "other-key")).toBeNull();

    const [, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ r: "req-2", a: "boss-1", exp: Math.floor(NOW / 1000) + 999999 })).toString("base64url");
    expect(verifyApprovalToken(`${forged}.${sig}`, NOW, KEY)).toBeNull();
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "a.b.c", ".", "not.base64!!"]) expect(verifyApprovalToken(bad, NOW, KEY)).toBeNull();
    const noExp = signApprovalToken({ r: "x", a: "y" } as never, KEY);
    expect(verifyApprovalToken(noExp, NOW, KEY)).toBeNull();
  });
});
