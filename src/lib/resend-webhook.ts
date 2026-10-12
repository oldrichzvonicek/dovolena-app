// Ověření podpisu webhooku Resendu (Svix): HMAC-SHA256 z `${svix-id}.${svix-timestamp}.${tělo}` s klíčem
// z `whsec_<base64>`. Bez závislosti — stačí node:crypto.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export function verifyResendWebhook(opts: { secret: string; id: string | null; timestamp: string | null; signature: string | null; body: string; now?: number }): boolean {
  const { secret, id, timestamp, signature, body } = opts;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // Hlavička může nést víc podpisů ("v1,xxx v1,yyy") kvůli rotaci klíče.
  return signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type DeliveryStatus = "delivered" | "delayed" | "bounced" | "complained";

/** Událost Resendu → stav doručení a případně důvod k potlačení adresy. Ostatní události (sent, opened…) se ignorují. */
export function interpretEvent(evt: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string } } }) {
  const emailId = evt.data?.email_id;
  if (!emailId) return null;
  const to = (evt.data?.to ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  switch (evt.type) {
    case "email.delivered":
      return { emailId, status: "delivered" as DeliveryStatus, suppress: null, to };
    case "email.delivery_delayed":
      return { emailId, status: "delayed" as DeliveryStatus, suppress: null, to };
    case "email.complained":
      return { emailId, status: "complained" as DeliveryStatus, suppress: "complained" as const, to };
    case "email.bounced":
      // Jen trvalý bounce (neexistující schránka) adresu potlačí; dočasný (plná schránka) se jen zaznamená.
      return { emailId, status: "bounced" as DeliveryStatus, suppress: evt.data?.bounce?.type?.toLowerCase() === "permanent" ? ("bounced" as const) : null, to };
    default:
      return null;
  }
}
