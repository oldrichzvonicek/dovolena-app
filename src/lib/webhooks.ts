// Server-side chat webhook delivery (Slack, Teams, Mattermost, Discord, Google Chat, generic).

export type WebhookProvider = "slack" | "teams" | "mattermost" | "discord" | "google_chat" | "webhook";

export const PROVIDER_LABELS: Record<WebhookProvider, string> = {
  slack: "Slack",
  teams: "Microsoft Teams",
  mattermost: "Mattermost",
  discord: "Discord",
  google_chat: "Google Chat",
  webhook: "Obecný webhook (Zapier, Make…)",
};

export const EVENT_LABELS: Record<string, string> = {
  request_created: "Nová žádost čeká na schválení",
  request_decided: "Žádost schválena / zamítnuta",
  cancellation_requested: "Žádost o zrušení absence",
  daily_digest: "Ranní přehled: kdo dnes chybí",
};

/** Message body per provider. */
export function buildPayload(provider: WebhookProvider, text: string): unknown {
  switch (provider) {
    case "discord":
      return { content: text };
    case "teams":
      // Works with Teams "Workflows" webhooks (Adaptive Card message).
      return {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: { type: "AdaptiveCard", version: "1.4", body: [{ type: "TextBlock", text, wrap: true }] },
          },
        ],
      };
    case "webhook":
      return { text, source: "dodio" };
    default:
      // Slack, Mattermost, Google Chat all accept {"text": "..."}.
      return { text };
  }
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal)$/i;

/** The URL is admin-supplied and fetched from our server, so refuse anything that could reach internal services. */
export function validateWebhookUrl(raw: string, provider?: WebhookProvider): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Neplatná adresa webhooku.";
  }
  if (u.protocol !== "https:") return "Webhook musí používat https://.";
  const host = u.hostname;
  if (PRIVATE_HOST.test(host)) return "Adresa míří na interní server.";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return "Adresa míří do privátní sítě.";
    }
  }
  if (host.includes(":") || host.startsWith("[")) return "IPv6 adresy nejsou povolené.";
  if (provider === "slack" && !(host === "hooks.slack.com" && u.pathname.startsWith("/services/"))) {
    return "Toto není webhook Slacku. Adresa musí začínat https://hooks.slack.com/services/… (vytvoříte ji ve Slack Apps → Incoming Webhooks), ne adresou vašeho workspace.";
  }
  if (provider === "discord" && !/(^|.)discord(app)?.com$/.test(host)) return "Adresa webhooku Discordu musí být na discord.com.";
  return null;
}
