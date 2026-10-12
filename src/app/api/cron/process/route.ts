import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, isAuthorizedCron, retryDelayMinutes, sendEmailBatch } from "@/lib/email";
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
    const { data: company } = await supabase.from("companies").select("email_approval_enabled, require_mfa_staff").eq("id", companyId).single();
    if (company && (company.email_approval_enabled === false || company.require_mfa_staff === true)) return null;

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
      baseUrl: appUrl(),
    });
    return { html, body: `${m.body}\n\nSchválit: ${approve}\nZamítnout: ${reject}` };
  } catch {
    return null;
  }
}

type Row = { id: string; to_email: string; subject: string; body: string; attempts: number; notification_id?: string | null; category?: string | null };

/** Sends queued e-mails from email_outbox. Call every few minutes (Vercel Cron / pg_cron + pg_net). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  // Rows are claimed atomically (FOR UPDATE SKIP LOCKED), so two overlapping cron runs never send the same e-mail twice.
  // Falls back to a plain read only when the SQL function is not deployed yet.
  let pending: Row[] | null = null;
  const claimed = await supabase.rpc("claim_email_outbox", { p_limit: 50 });
  if (!claimed.error) {
    pending = claimed.data as Row[];
  } else {
    const { data, error } = await supabase
      .from("email_outbox")
      .select("id, to_email, subject, body, attempts, notification_id, category")
      .is("sent_at", null)
      .lt("attempts", 5)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    pending = data;
  }
  const rows = pending ?? [];

  // Adresy, které natvrdo nedoručily nebo si stěžovaly na spam (webhook Resendu), se už nezkouší — chrání pověst domény.
  // Bez nasazené tabulky (migrace) se kontrola tiše přeskočí.
  const suppressed = new Set<string>();
  if (rows.length > 0) {
    const { data: sup } = await supabase.from("email_suppressions").select("email").in("email", [...new Set(rows.map((r) => r.to_email.toLowerCase()))]);
    for (const s of sup ?? []) suppressed.add(s.email as string);
  }
  const isSuppressed = (m: Row) => suppressed.has(m.to_email.toLowerCase());

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let exhausted = 0;
  const blockedRows = rows.filter(isSuppressed);
  for (const m of blockedRows) {
    await supabase.from("email_outbox").update({ attempts: 5, error: "Adresa je na seznamu potlačených (dřívější nedoručitelnost nebo stížnost na spam)." }).eq("id", m.id);
  }

  const toSend = rows.filter((m) => !isSuppressed(m));
  const prepared = await Promise.all(
    toSend.map(async (m) => {
      const buttons = await withApprovalButtons(supabase, m);
      return { to: m.to_email, subject: m.subject, body: buttons?.body ?? m.body, html: buttons?.html, category: m.category, idempotencyKey: `dodio-outbox-${m.id}` };
    })
  );
  const results = await sendEmailBatch(prepared);

  for (const [i, m] of toSend.entries()) {
    const r = results[i];
    if (r.skipped) {
      skipped++;
      continue;
    }
    if (r.ok) {
      sent++;
      await supabase.from("email_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", m.id);
      // Zvlášť a nezávazně: před nasazením migrace sloupec neexistuje a nesmí kvůli němu e-mail zůstat "neodeslaný".
      if (r.id) await supabase.from("email_outbox").update({ resend_id: r.id }).eq("id", m.id);
    } else {
      failed++;
      const attempts = m.attempts + 1;
      if (attempts >= 5) {
        exhausted++;
        console.error(`e-mail ${m.id} (${m.category ?? "?"}) se nepodařilo odeslat ani na ${attempts}. pokus: ${r.error ?? "unknown"}`);
      }
      await supabase.from("email_outbox").update({ attempts, error: r.error ?? "unknown" }).eq("id", m.id);
      const next = new Date(Date.now() + retryDelayMinutes(attempts) * 60_000).toISOString();
      await supabase.from("email_outbox").update({ next_attempt_at: next }).eq("id", m.id);
    }
  }
  const integrations = await dispatchIntegrationEvents();
  return NextResponse.json({
    pending: rows.length,
    sent,
    failed,
    skipped,
    blocked: blockedRows.length,
    exhausted,
    integrations,
    note: skipped > 0 ? "RESEND_API_KEY není nastaven — nic se neodeslalo" : undefined,
  });
}
