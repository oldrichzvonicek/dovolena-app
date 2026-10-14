import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { settleInvoicePaid } from "@/server/platform/settle";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ruční „Označit jako zaplaceno“: zapíše platbu, uzavře fakturu, volitelně prodlouží platnost tarifu (extend_until)
 * a pozastavenou firmu bez dalších faktur po splatnosti vrátí do provozu. Faktury z Fakturoidu se zaplatí samy webhookem.
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

  const r = await settleInvoicePaid({ invoiceId: id, receivedAt, extendUntil, source: "manual", providerRef: ref, actor: a.ctx });
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : r.code === "bad_state" ? 409 : 500);
  return NextResponse.json({ ok: true });
}
