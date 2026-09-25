// Server-only e-mail sending (Resend HTTP API). Without RESEND_API_KEY nothing is sent and callers get { skipped: true }.

import { emailLayout, FOOTER_NOTIFICATION } from "@/lib/email-templates";

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
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
  });
}

/** Sends one e-mail. `html` (e.g. from renderTemplate) overrides the generic layout built from the plain-text body. */
export async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = process.env.EMAIL_FROM ?? "Dodio <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: `${body}\n\n${appUrl()}/dashboard`, html: html ?? renderHtml(subject, body) }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Cron endpoints accept only `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends it automatically). */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
}
