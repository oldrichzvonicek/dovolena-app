import { NextResponse } from "next/server";
import { apiError, authorize, writeAudit } from "@/server/platform/auth";
import { sendManualReminder } from "@/server/platform/dunning";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Ruční upomínka k faktuře: nejvýš jednou za 24 hodin, jinak 429 reminder_too_soon. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "billing.write");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  const r = await sendManualReminder(id);
  if (!r.ok) {
    if (r.code === "reminder_too_soon") return apiError("reminder_too_soon", "Upomínka už byla odeslána v posledních 24 hodinách.", 429, { "Retry-After": "86400" });
    return apiError(r.code, r.code === "not_found" ? "Faktura nebyla nalezena." : "Upomínku lze poslat jen k vystavené faktuře.", r.code === "not_found" ? 404 : 409);
  }
  await writeAudit(a.ctx, { action: "invoice.remind", details: { invoice: id, sent: r.sent } });
  return NextResponse.json({ ok: true, sent: r.sent });
}
