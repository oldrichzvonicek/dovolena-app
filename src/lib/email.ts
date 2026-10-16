// Server-only e-mail sending (Resend HTTP API). Without RESEND_API_KEY nothing is sent and callers get { skipped: true }.

import { createHash } from "node:crypto";
import { emailLayout, FOOTER_NOTIFICATION, FOOTER_TRANSACTIONAL } from "@/lib/email-templates";

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

// Tlačítko v e-mailu podle druhu e-mailu (kategorie z email_outbox, u provozních typ upozornění); jinak nástěnka.
const CTA_BY_CATEGORY: Record<string, { label: string; path: string }> = {
  approver_requests: { label: "Otevřít žádosti ke schválení", path: "/approvals" },
  requester_decisions: { label: "Zobrazit moje žádosti", path: "/requests" },
  weekly_digest: { label: "Otevřít kalendář", path: "/calendar" },
  hr_digest: { label: "Otevřít Analytiku", path: "/admin/overview" },
  reminders: { label: "Naplánovat dovolenou", path: "/calendar" },
  join_pending: { label: "Schválit nebo odmítnout", path: "/admin/settings?sekce=users" },
  billing: { label: "Otevřít fakturaci", path: "/admin/settings?sekce=billing" },
  account_approved: { label: "Přihlásit se", path: "/login" },
  welcome: { label: "Otevřít Dodio", path: "/dashboard" },
};

/** Plain-text body -> branded HTML (paragraphs by blank line); shared layout with the templates in email-templates.ts. */
const FOOTER_SIGNUP = "Pokud jste se neregistrovali, tento e-mail ignorujte, účet nebude aktivován. Potřebujete poradit? Odpovězte na tento e-mail.";

const FOOTER_TIPS = "Tipy po registraci můžete vypnout v Nastavení firmy → Notifikace, nebo nám stačí odpovědět na tento e-mail.";
const CTA_TRAILER = /\n\n@@cta (.+?) \| (\S+)\s*$/;

const FOOTER_BILLING = "S pozdravem, tým Dodio. Dotazy k fakturaci nebo platbě: odpovězte na tento e-mail nebo napište na podpora@dodio.cz. Tento e-mail je provozní a nelze ho vypnout.";
const QR_LINE = /(?:^|\n\n)@@qr (\d+(?:\.\d+)?)\|(\d{1,10})(?=\n\n|$)/;
const BILLING_SIGNATURE = /\n\nS pozdravem\ntým Dodio\s*$/;

export function renderHtml(subject: string, body: string, category?: string | null): string {
  if (category === "billing") {
    // Podpis "S pozdravem, tým Dodio" patří do patičky, ne mezi odstavce nad tlačítkem.
    const cta = CTA_BY_CATEGORY.billing;
    // Poslední řádek těla může nést odkaz na PDF faktury: "@@cta Popisek | https://…" (server/platform/email.ts).
    const pdf = body.match(CTA_TRAILER);
    const withoutPdf = (pdf ? body.slice(0, pdf.index) : body).replace(BILLING_SIGNATURE, "");
    // Řádek "@@qr částka|VS" → obrázek QR platby (endpoint /api/qr) pod textem.
    const qr = withoutPdf.match(QR_LINE);
    const clean = withoutPdf.replace(QR_LINE, "");
    const qrHtml = qr
      ? `<div style="margin:14px 0 6px"><img src="${appUrl()}/api/qr?am=${qr[1]}&vs=${qr[2]}" width="160" height="160" alt="QR platba" style="display:block;border:1px solid #D3D1C7;border-radius:6px" /><div style="font-size:12px;color:#5F5E5A;margin-top:6px">Naskenujte v bankovní aplikaci (QR platba).</div></div>`
      : undefined;
    return emailLayout({
      title: subject,
      afterBody: qrHtml,
      paragraphs: clean.split(/\n{2,}/),
      cta: pdf ? { label: pdf[1], url: pdf[2] } : { label: cta.label, url: `${appUrl()}${cta.path}` },
      actions: pdf ? [{ label: cta.label, url: `${appUrl()}${cta.path}`, kind: "link" as const }] : undefined,
      footer: FOOTER_BILLING,
      baseUrl: appUrl(),
    });
  }
  if (category === "onboarding_tips") {
    // Poslední řádek těla nese tlačítko: "@@cta Popisek | https://…" (cron/daily).
    const cta = body.match(CTA_TRAILER);
    return emailLayout({
      title: subject,
      paragraphs: (cta ? body.slice(0, cta.index) : body).split(/\n{2,}/),
      cta: cta ? { label: cta[1], url: cta[2] } : undefined,
      footer: FOOTER_TIPS,
      baseUrl: appUrl(),
    });
  }
  if (category === "nps") {
    // Řádek "@@nps https://…/api/nps?token=…" (cron/daily) se stane řadou čísel 0–10; klik připojí &score=N.
    const m = /^@@nps (\S+)$/m.exec(body);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const cell = (n: number) =>
      `<td style="padding:0 2px"><a href="${esc(`${m![1]}&score=${n}`)}" style="display:block;text-align:center;text-decoration:none;border:1px solid #D3D1C7;border-radius:6px;padding:10px 0;font-size:14px;font-weight:bold;color:#085041">${n}</a></td>`;
    const scale = m
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0"><tr>${Array.from({ length: 11 }, (_, n) => cell(n)).join("")}</tr></table>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;font-size:12px;color:#5F5E5A"><tr><td align="left">0 = určitě ne</td><td align="right">10 = určitě ano</td></tr></table>`
      : "";
    return emailLayout({
      title: subject,
      paragraphs: body.replace(/^@@nps .*$/m, "").split(/\n{2,}/).filter((p) => p.trim()),
      afterBody: scale,
      footer: FOOTER_TRANSACTIONAL,
      baseUrl: appUrl(),
    });
  }
  if (category === "signup_reminder") {
    // Poslední řádek těla je jednorázový potvrzovací odkaz (cron/daily) — z něj se stane tlačítko.
    const link = body.match(/\n\n(https?:\/\/\S+)\s*$/);
    return emailLayout({
      title: subject,
      paragraphs: (link ? body.slice(0, link.index) : body).split(/\n{2,}/),
      cta: link ? { label: "Potvrdit e-mail a začít", url: link[1] } : undefined,
      footer: FOOTER_SIGNUP,
      baseUrl: appUrl(),
    });
  }
  const cta = (category && CTA_BY_CATEGORY[category]) || { label: "Otevřít Dodio", path: "/dashboard" };
  return emailLayout({
    title: subject,
    paragraphs: body.split(/\n{2,}/),
    cta: { label: cta.label, url: `${appUrl()}${cta.path}` },
    // Provozní (fakturační) e-maily se vypnout nedají, proto nesmí lákat k vypnutí v notifikacích.
    footer: category === "billing" ? FOOTER_TRANSACTIONAL : FOOTER_NOTIFICATION,
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

// Ukázkové a testovací účty mají adresy v rezervovaných doménách .invalid a .test — nikdy se na ně nic neposílá (jinak by se odrážely a kazily pověst domény).
const isSkippedAddress = (to: string) => /\.(invalid|test)$/i.test(to.trim());

function payload(to: string, subject: string, body: string, html: string | undefined, category?: string | null) {
  const replyTo = process.env.EMAIL_REPLY_TO ?? DEFAULT_REPLY_TO;
  return {
    from: senderFor(category),
    to: [to],
    subject,
    // "## " je značka nadpisu skupiny v HTML (renderParagraph); v textové verzi je zbytečná.
    text:
      category === "billing"
        ? `${body.replace(QR_LINE, "").replace(CTA_TRAILER, (_x, label: string, url: string) => `\n\n${label}: ${url}`)}\n\n${appUrl()}${CTA_BY_CATEGORY.billing.path}`
        : category === "onboarding_tips"
          ? `${body.replace(CTA_TRAILER, (_x, label: string, url: string) => `\n\n${label}: ${url}`)}\n\n${FOOTER_TIPS}`
          : category === "signup_reminder"
            ? `${body}\n\n${FOOTER_SIGNUP}`
            : category === "nps"
              ? `${body.replace(/^@@action (.+?) \| (\S+)$/gm, (_x, label: string, url: string) => `${label}: ${url}`)}\n\n${FOOTER_TRANSACTIONAL}`
              : `${body.replace(/^## /gm, "")}\n\n${appUrl()}${(category && CTA_BY_CATEGORY[category]?.path) || "/dashboard"}`,
    html: html ?? renderHtml(subject, body, category),
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
