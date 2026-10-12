import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { interpretEvent, verifyResendWebhook } from "@/lib/resend-webhook";

export const dynamic = "force-dynamic";

/**
 * Webhook Resendu: stav doručení (delivered / bounced / complained) k e-mailu z email_outbox a potlačení adres,
 * na které se nedá psát. Resend ho volá s podpisem Svix; RESEND_WEBHOOK_SECRET (whsec_…) se bere z nastavení webhooku.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const body = await req.text();
  const ok = verifyResendWebhook({
    secret,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body,
  });
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let evt;
  try {
    evt = interpretEvent(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!evt) return NextResponse.json({ ignored: true });

  const supabase = createAdminClient();
  let q = supabase.from("email_outbox").update({ delivery_status: evt.status, delivery_at: new Date().toISOString() }).eq("resend_id", evt.emailId);
  // Opožděná zpráva "delivered" nesmí přepsat bounce / stížnost, které přišly dřív.
  if (evt.status === "delivered" || evt.status === "delayed") q = q.or("delivery_status.is.null,delivery_status.not.in.(bounced,complained)");
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (evt.suppress && evt.to.length > 0) {
    const { error: e } = await supabase.from("email_suppressions").upsert(evt.to.map((email) => ({ email, reason: evt.suppress })), { onConflict: "email" });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
