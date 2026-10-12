import { describe, expect, it } from "vitest";
import { signupAction } from "./signup-reminders";

const none = { first: false, last: false };

describe("signupAction", () => {
  it("před 24 h nic", () => {
    expect(signupAction(5, none)).toBeNull();
  });
  it("po 24 h jedna připomínka, pak už ne", () => {
    expect(signupAction(30, none)).toBe("first");
    expect(signupAction(30, { first: true, last: false })).toBeNull();
  });
  it("po 7 dnech poslední připomínka, i když ta první nešla (výpadek cronu)", () => {
    expect(signupAction(7 * 24 + 1, { first: true, last: false })).toBe("last");
    expect(signupAction(8 * 24, none)).toBe("last");
    expect(signupAction(8 * 24, { first: true, last: true })).toBeNull();
  });
  it("po 30 dnech smazat", () => {
    expect(signupAction(31 * 24, { first: true, last: true })).toBe("delete");
  });
});
