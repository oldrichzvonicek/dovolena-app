import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron, sendEmail } from "@/lib/email";
import { dispatchIntegrationEvents } from "@/lib/integration-dispatch";

export const dynamic = "force-dynamic";

/** Sends queued e-mails from email_outbox. Call every few minutes (Vercel Cron / pg_cron + pg_net). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  // Rows are claimed atomically (FOR UPDATE SKIP LOCKED), so two overlapping cron runs never send the same e-mail twice.
  // Falls back to a plain read only when the SQL function is not deployed yet.
  let pending: { id: string; to_email: string; subject: string; body: string; attempts: number }[] | null = null;
  const claimed = await supabase.rpc("claim_email_outbox", { p_limit: 50 });
  if (!claimed.error) {
    pending = claimed.data as typeof pending;
  } else {
    const { data, error } = await supabase
      .from("email_outbox")
      .select("id, to_email, subject, body, attempts")
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
    const r = await sendEmail(m.to_email, m.subject, m.body);
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
