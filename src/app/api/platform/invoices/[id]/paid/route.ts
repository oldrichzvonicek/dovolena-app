import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { companyLabel } from "@/server/platform/companies";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ruční „Označit jako zaplaceno“: zapíše platbu, uzavře fakturu, volitelně prodlouží platnost tarifu (extend_until)
 * a pozastavenou firmu bez dalších faktur po splatnosti vrátí do provozu.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "billing.write");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { received_at?: unknown; extend_until?: unknown; provider_ref?: unknown };
  const receivedAt = typeof body.received_at === "string" && ISO.test(body.received_at) ? body.received_at : todayIso();
  const extendUntil = typeof body.extend_until === "string" && ISO.test(body.extend_until) ? body.extend_until : null;
  const ref = typeof body.provider_ref === "string" ? body.provider_ref.trim().slice(0, 100) || null : null;

  const db = platformDb();
  const { data: invoice } = await db.from("company_invoices").select("id, company_id, number, amount, status").eq("id", id).maybeSingle();
  if (!invoice) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  if (invoice.status !== "issued") return apiError("bad_state", invoice.status === "paid" ? "Faktura je už zaplacená." : "Fakturu ve stavu storno nelze zaplatit.", 409);
  const { data: company } = await db.from("companies").select("id, seq_id, name, status, plan_paid_until").eq("id", invoice.company_id).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);

  // Uzavření faktury jen z právě „vystavené“ (ochrana proti dvojímu kliknutí).
  const { data: closed } = await db.from("company_invoices").update({ status: "paid", paid_at: receivedAt }).eq("id", id).eq("status", "issued").select("id");
  if ((closed?.length ?? 0) !== 1) return apiError("bad_state", "Faktura je už zaplacená.", 409);
  const { error: payErr } = await db.from("payments").insert({ invoice_id: id, company_id: invoice.company_id, source: "manual", provider_ref: ref, amount: invoice.amount, received_at: receivedAt, created_by: a.ctx.userId });
  if (payErr) {
    await db.from("company_invoices").update({ status: "issued", paid_at: null }).eq("id", id);
    await writeAudit(a.ctx, { action: "invoice.paid", result: "error", companyId: company.id, companyLabel: companyLabel(company), details: { number: invoice.number, error: payErr.message } });
    return apiError("insert_failed", "Platbu se nepodařilo zapsat.", 500);
  }

  const details: Record<string, unknown> = { number: invoice.number, amount: Number(invoice.amount), received_at: receivedAt };
  if (extendUntil && extendUntil !== company.plan_paid_until) {
    await db.from("companies").update({ plan_paid_until: extendUntil }).eq("id", company.id);
    details.plan_paid_until = { from: company.plan_paid_until, to: extendUntil };
  }
  if (company.status === "suspended") {
    const { data: stillOverdue } = await db.from("company_invoices").select("id").eq("company_id", company.id).eq("status", "issued").lt("due_at", todayIso()).limit(1);
    if ((stillOverdue?.length ?? 0) === 0) {
      await db.from("companies").update({ status: "active" }).eq("id", company.id);
      details.status = { from: "suspended", to: "active" };
    }
  }
  await writeAudit(a.ctx, { action: "invoice.paid", companyId: company.id, companyLabel: companyLabel(company), details });
  return NextResponse.json({ ok: true });
}
