import { NextResponse } from "next/server";
import { STEP_UP_HEADER, apiError, authorize, consumeStepUp, writeAudit } from "@/server/platform/auth";
import { isMinutes, startImpersonation } from "@/server/platform/impersonation";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Zahájí náhled firmy jen pro čtení. Vyžaduje důvod, délku (15/30/60 min) a step-up token; admin firmy dostane e-mail. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.impersonate");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; note?: unknown; minutes?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  if (reason.length < 5) return apiError("invalid_input", "Uveďte důvod (aspoň 5 znaků), zákazník ho uvidí v e-mailu.", 400);
  if (!isMinutes(body.minutes)) return apiError("invalid_input", "Délka musí být 15, 30 nebo 60 minut.", 400);

  const action = `company.impersonate:${id}`;
  if (!(await consumeStepUp(a.ctx, action, req.headers.get(STEP_UP_HEADER)))) {
    await writeAudit(a.ctx, { action: "denied:step_up", result: "denied", companyId: id, details: { for: action } });
    return apiError("step_up_required", "Potvrďte akci novým kódem TOTP.", 403);
  }
  const r = await startImpersonation(a.ctx, id, reason, note, body.minutes);
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);
  return NextResponse.json({ ok: true, id: r.id });
}
