// Server-only e-mail sending (Resend HTTP API). Without RESEND_API_KEY nothing is sent and callers get { skipped: true }.

import { createHash } from "node:crypto";
import { emailLayout, FOOTER_NOTIFICATION } from "@/lib/email-templates";

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  /** Resend e-mail id — podle něj k e-mailu přiřadí webhook doručení / bounce. */
  id?: string;
  /** Resend zprávu určitě nepřijal (4xx kromě 429) — na rozdíl od chyby sítě / 5xx, kdy se neví. */
  rejected?: boolean;
}

export interface SendOptions {
  /** Kategorie z email_outbox (billing → vlastní odesílatel). */
  category?: string | null;
  /** Stejný klíč = Resend (24 h) druhý pokus nepošle znovu, jen vrátí původní odpověď. */
  idempotencyKey?: string;
}

export interface BatchItem extends SendOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Plain-text body -> branded HTML (paragraphs by blank line); shared layout with the templates in email-templates.ts. */
export function renderHtml(subject: string, body: string): string {
  return emailLayout({
    title: subject,
    paragraphs: body.split(/\n{2,}/),
    cta: { label: "Otevřít Dodio", url: `${appUrl()}/dashboard` },
    footer: FOOTER_NOTIFICATION,
    baseUrl: appUrl(),
  });
}

// Schránky fakturace@ a podpora@ musí na doméně existovat, jinak odpovědi zmizí (přepsat jde proměnnými EMAIL_FROM_BILLING / EMAIL_REPLY_TO).
const DEFAULT_BILLING_FROM = "Dodio fakturace <fakturace@dodio.cz>";
const DEFAULT_REPLY_TO = "podpora@dodio.cz";

/** Odesílatel podle kategorie (fakturace má vlastního, ostatní EMAIL_FROM). Doména musí být ověřená v Resendu. */
export function senderFor(category?: string | null): string {
  const general = process.env.EMAIL_FROM ?? "Dodio <onboarding@resend.dev>";
  if (category === "billing") return process.env.EMAIL_FROM_BILLING ?? DEFAULT_BILLING_FROM;
  return general;
}

// Ukázkové účty mají adresy v doméně .invalid — nikdy se na ně nic neposílá.
const isSkippedAddress = (to: string) => to.toLowerCase().endsWith(".invalid");

function payload(to: string, subject: string, body: string, html: string | undefined, category?: string | null) {
  const replyTo = process.env.EMAIL_REPLY_TO ?? DEFAULT_REPLY_TO;
  return {
    from: senderFor(category),
    to: [to],
    subject,
    // "## " je značka nadpisu skupiny v HTML (renderParagraph); v textové verzi je zbytečná.
    text: `${body.replace(/^## /gm, "")}\n\n${appUrl()}/dashboard`,
    html: html ?? renderHtml(subject, body),
    ...(replyTo ? { reply_to: replyTo } : {}),
  };
}

const isRejection = (status: number) => status >= 400 && status < 500 && status !== 429;

/** Sends one e-mail. `html` (e.g. from renderTemplate) overrides the generic layout built from the plain-text body. */
export async function sendEmail(to: string, subject: string, body: string, html?: string, opts: SendOptions = {}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  if (isSkippedAddress(to)) return { ok: false, skipped: true };
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers, body: JSON.stringify(payload(to, subject, body, html, opts.category)) });
    if (!res.ok) return { ok: false, rejected: isRejection(res.status), error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/**
 * Sends up to 100 e-mails in one Resend request; results are in the order of `items`. When Resend rejects the whole
 * batch with a 4xx (one bad message sinks all of it), the messages go one by one so only the bad one fails.
 * A network error / 5xx / 429 is NOT retried here — the batch may have been accepted, the caller's backoff retries.
 */
export async function sendEmailBatch(items: BatchItem[]): Promise<SendResult[]> {
  const results: SendResult[] = items.map(() => ({ ok: false, skipped: true }));
  const key = process.env.RESEND_API_KEY;
  if (!key) return results;
  const live = items.map((_, i) => i).filter((i) => !isSkippedAddress(items[i].to));
  if (live.length === 0) return results;
  const single = async (i: number) => {
    const it = items[i];
    results[i] = await sendEmail(it.to, it.subject, it.body, it.html, { category: it.category, idempotencyKey: it.idempotencyKey });
  };
  if (live.length === 1) {
    await single(live[0]);
    return results;
  }
  // shortcut: klíč dávky závisí na složení dávky — při ztracené odpovědi a jiném složení příště může jít zpráva dvakrát; při větším objemu přejít na odesílání po jedné s per-zprávovým klíčem.
  const idem = `batch-${createHash("sha256").update(live.map((i) => items[i].idempotencyKey ?? items[i].to).join(",")).digest("hex").slice(0, 40)}`;
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idem },
      body: JSON.stringify(live.map((i) => payload(items[i].to, items[i].subject, items[i].body, items[i].html, items[i].category))),
    });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] };
      live.forEach((i, n) => (results[i] = { ok: true, id: json.data?.[n]?.id }));
      return results;
    }
    if (isRejection(res.status)) {
      for (const i of live) await single(i);
      return results;
    }
    const error = `${res.status} ${(await res.text()).slice(0, 200)}`;
    for (const i of live) results[i] = { ok: false, error };
  } catch (e) {
    const error = e instanceof Error ? e.message : "send failed";
    for (const i of live) results[i] = { ok: false, error };
  }
  return results;
}

/** Za kolik minut zkusit e-mail znovu po `failures`-tém neúspěchu (cron běží po 3 minutách, takže první pokus je hned příště). */
export function retryDelayMinutes(failures: number): number {
  return [0, 3, 15, 60, 240][Math.min(Math.max(failures, 0), 4)];
}

/** Cron endpoints accept only `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it automatically). */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
