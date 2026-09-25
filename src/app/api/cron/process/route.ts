import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, isAuthorizedCron, sendEmail } from "@/lib/email";
import { emailLayout, FOOTER_NOTIFICATION } from "@/lib/email-templates";
import { newApprovalToken } from "@/lib/approval-token";
import { dispatchIntegrationEvents } from "@/lib/integration-dispatch";

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * E-mail o nové žádosti dostane schvalovatel s tlačítky Schválit / Zamítnout (podepsaný odkaz na potvrzovací stránku).
 * Tlačítka se přidají jen ke skutečně čekající žádosti a jen když firma schvalování z e-mailu nevypnula.
 */
async function withApprovalButtons(supabase: Admin, m: { notification_id?: string | null; subject: string; body: string }) {
  if (!m.notification_id) return null;
  try {
    const { data: n } = await supabase.from("notifications").select("type, leave_request_id, profile_id").eq("id", m.notification_id).single();
    if (!n || n.type !== "request_created" || !n.leave_request_id) return null;
    const { data: req } = await supabase.from("leave_requests").select("status, profile:profiles!leave_requests_profile_id_fkey(company_id)").eq("id", n.leave_request_id).single();
    const companyId = (req?.profile as unknown as { company_id: string } | null)?.company_id;
    if (!req || req.status !== "pending" || !companyId) return null;
    const { data: company } = await supabase.from("companies").select("email_approval_enabled").eq("id", companyId).single();
    if (company && company.email_approval_enabled === false) return null;

    const base = `${appUrl()}/approve/${newApprovalToken(n.leave_request_id as string, n.profile_id as string)}`;
    const approve = `${base}?akce=schvalit`;
    const reject = `${base}?akce=zamitnout`;
    const html = emailLayout({
      title: m.subject,
      paragraphs: m.body.split(/\n{2,}/),
      actions: [
        { label: "Schválit", url: approve, kind: "approve" },
        { label: "Zamítnout", url: reject, kind: "reject" },
        { label: "Otevřít v aplikaci", url: `${appUrl()}/approvals`, kind: "link" },
      ],
      footer: `${FOOTER_NOTIFICATION} Tlačítka platí 7 dní a vedou na stránku, kde rozhodnutí potvrdíte.`,
    });
    return { html, body: `${m.body}\n\nSchválit: ${approve}\nZamítnout: ${reject}` };
  } catch {
    return null;
  }
}

/** Sends queued e-mails from email_outbox. Call every few minutes (Vercel Cron / pg_cron + pg_net). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  // Rows are claimed atomically (FOR UPDATE SKIP LOCKED), so two overlapping cron runs never send the same e-mail twice.
  // Falls back to a plain read only when the SQL function is not deployed yet.
  let pending: { id: string; to_email: string; subject: string; body: string; attempts: number; notification_id?: string | null }[] | null = null;
  const claimed = await supabase.rpc("claim_email_outbox", { p_limit: 50 });
  if (!claimed.error) {
    pending = claimed.data as typeof pending;
  } else {
    const { data, error } = await supabase
      .from("email_outbox")
      .select("id, to_email, subject, body, attempts, notification_id")
      .is("sent_at", null)
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pending = data;
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const m of pending ?? []) {
    const buttons = await withApprovalButtons(supabase, m);
    const r = buttons ? await sendEmail(m.to_email, m.subject, buttons.body, buttons.html) : await sendEmail(m.to_email, m.subject, m.body);
    if (r.skipped) {
      skipped++;
      continue;
    }
    if (r.ok) {
      sent++;
      await supabase.from("email_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", m.id);
    } else {
      failed++;
      await supabase.from("email_outbox").update({ attempts: m.attempts + 1, error: r.error ?? "unknown" }).eq("id", m.id);
    }
  }
  const integrations = await dispatchIntegrationEvents();
  return NextResponse.json({ pending: pending?.length ?? 0, sent, failed, skipped, integrations, note: skipped > 0 ? "RESEND_API_KEY není nastaven — nic se neodeslalo" : undefined });
}
