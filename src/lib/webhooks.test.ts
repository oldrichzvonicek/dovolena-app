import { describe, expect, it } from "vitest";
import { buildPayload, validateWebhookUrl } from "./webhooks";

describe("validateWebhookUrl", () => {
  it("accepts public https URLs", () => {
    expect(validateWebhookUrl("https://hooks.slack.com/services/T000/B000/XXX")).toBeNull();
    expect(validateWebhookUrl("https://chat.example.com/hooks/abc")).toBeNull();
  });
  it("rejects http, localhost and private networks", () => {
    expect(validateWebhookUrl("http://hooks.slack.com/x")).not.toBeNull();
    expect(validateWebhookUrl("https://localhost/x")).not.toBeNull();
    expect(validateWebhookUrl("https://127.0.0.1/x")).not.toBeNull();
    expect(validateWebhookUrl("https://10.1.2.3/x")).not.toBeNull();
    expect(validateWebhookUrl("https://192.168.0.5/x")).not.toBeNull();
    expect(validateWebhookUrl("https://169.254.169.254/latest")).not.toBeNull();
    expect(validateWebhookUrl("https://intranet.internal/x")).not.toBeNull();
    expect(validateWebhookUrl("not a url")).not.toBeNull();
  });
});

describe("buildPayload", () => {
  it("uses the shape each service expects", () => {
    expect(buildPayload("slack", "hi")).toEqual({ text: "hi" });
    expect(buildPayload("mattermost", "hi")).toEqual({ text: "hi" });
    expect(buildPayload("discord", "hi")).toEqual({ content: "hi" });
    expect((buildPayload("teams", "hi") as { attachments: unknown[] }).attachments).toHaveLength(1);
  });
});
