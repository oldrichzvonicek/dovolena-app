import { NextResponse } from "next/server";
import { platformDb } from "@/server/platform/auth";
import { fakturoidConfig, isValidWebhookAuth } from "@/server/platform/fakturoid";
import { settleInvoicePaid } from "@/server/platform/settle";
import { todayIso } from "@/server/platform/billing";

export const dynamic = "force-dynamic";

/**
 * Webhook Fakturoidu (událost invoice_paid): faktura vystavená přes Fakturoid se uzavře, prodlouží se tarif a firma
 * se případně vrátí do provozu — bez ručního „Označit jako zaplaceno“. Ověřuje se hlavička Authorization.
 */
export async function POST(req: Request) {
  const cfg = fakturoidConfig();
  if (!cfg) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!isValidWebhookAuth(req.headers.get("authorization"), cfg)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const evt = (await req.json().catch(() => null)) as { event_name?: string; body?: { invoice?: { id?: number }; payment?: { id?: number; paid_on?: string } } } | null;
  if (evt?.event_name !== "invoice_paid" || !evt.body?.invoice?.id) return NextResponse.json({ ignored: true });

  const { data: invoice } = await platformDb().from("company_invoices").select("id, status").eq("fakturoid_id", evt.body.invoice.id).maybeSingle();
  if (!invoice) return NextResponse.json({ ignored: "unknown invoice" });
  if (invoice.status !== "issued") return NextResponse.json({ ok: true, already: invoice.status });

  const paidOn = evt.body.payment?.paid_on && /^\d{4}-\d{2}-\d{2}$/.test(evt.body.payment.paid_on) ? evt.body.payment.paid_on : todayIso();
  const r = await settleInvoicePaid({
    invoiceId: invoice.id,
    receivedAt: paidOn,
    source: "gateway",
    providerRef: evt.body.payment?.id ? `fakturoid:${evt.body.payment.id}` : "fakturoid",
    actor: null,
  });
  if (!r.ok && r.code !== "bad_state") return NextResponse.json({ error: r.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
