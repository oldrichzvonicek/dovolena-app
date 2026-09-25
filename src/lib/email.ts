// Server-only e-mail sending (Resend HTTP API). Without RESEND_API_KEY nothing is sent and callers get { skipped: true }.

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Plain-text body -> simple branded HTML (paragraphs by blank line, single newlines kept). */
export function renderHtml(subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:Arial,Helvetica,sans-serif;color:#2C2C2A">
<div style="max-width:560px;margin:0 auto;padding:24px">
  <div style="font-size:20px;font-weight:bold;color:#085041;margin-bottom:16px">Dodio</div>
  <div style="background:#fff;border:1px solid #D3D1C7;border-radius:8px;padding:24px">
    <h1 style="font-size:18px;margin:0 0 14px">${esc(subject)}</h1>
    ${paragraphs}
    <a href="${appUrl()}/dashboard" style="display:inline-block;margin-top:6px;background:#085041;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px">Otevřít Dodio</a>
  </div>
  <div style="font-size:12px;color:#5F5E5A;margin-top:14px">Upozornění můžete vypnout v aplikaci u zvonečku notifikací.</div>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const from = process.env.EMAIL_FROM ?? "Dodio <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: `${body}\n\n${appUrl()}/dashboard`, html: renderHtml(subject, body) }),
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
