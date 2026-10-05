import { NextResponse } from "next/server";
import { STEP_UP_HEADER, apiError, authorize, consumeStepUp, platformDb, writeAudit } from "@/server/platform/auth";
import { queueCompanyEmail, SIGNATURE, czDate } from "@/server/platform/email";
import { cancelCompanyJobs, enqueueJob } from "@/server/platform/jobs";
import { isCompanyStatus, setCompanyStatus } from "@/server/platform/status";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const GRACE_DAYS = 30;
const REMIND_BEFORE_DAYS = 7;

/**
 * Naplánuje smazání firmy za 30 dní (ochranná lhůta). V jedné operaci: stav pending_deletion, odhlášení členů, zrušení
 * naplánované změny tarifu, úlohy exportu, připomenutí 7 dní předem a definitivního smazání. Vyžaduje step-up token.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.delete");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; notify_owner?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (reason.length < 3) return apiError("invalid_input", "Uveďte důvod smazání.", 400);

  const action = `company.delete:${id}`;
  if (!(await consumeStepUp(a.ctx, action, req.headers.get(STEP_UP_HEADER)))) {
    await writeAudit(a.ctx, { action: "denied:step_up", result: "denied", companyId: id, details: { for: action } });
    return apiError("step_up_required", "Potvrďte akci novým kódem TOTP.", 403);
  }

  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, status").eq("id", id).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);

  const scheduledAt = new Date(Date.now() + GRACE_DAYS * 86_400_000);
  const r = await setCompanyStatus(a.ctx, id, "pending_deletion", {
    action: "company.delete",
    details: { reason, scheduledAt: scheduledAt.toISOString() },
    allowFrom: ["active", "suspended"],
    extra: { deletion_scheduled_at: scheduledAt.toISOString(), deletion_reason: reason, status_before_deletion: company.status, pending_plan: null, pending_plan_from: null, pending_plan_notified: false },
  });
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);

  const { data: revoked } = await db.rpc("platform_revoke_company_sessions", { p_company: id });
  const notify = body.notify_owner !== false;
  await enqueueJob("company.export", id, { notify, linkDays: GRACE_DAYS }, new Date(), a.ctx.userId);
  await enqueueJob("company.deletion.remind", id, {}, new Date(scheduledAt.getTime() - REMIND_BEFORE_DAYS * 86_400_000), a.ctx.userId);
  await enqueueJob("company.deletion.execute", id, {}, scheduledAt, a.ctx.userId);
  let emailed = 0;
  if (notify) {
    emailed = await queueCompanyEmail(
      id,
      "Účet vaší firmy v Dodio bude smazán",
      `Dobrý den,\n\núčet vaší firmy je naplánovaný ke smazání dne ${czDate(scheduledAt)}. Do té doby se do aplikace nelze přihlásit. Export všech vašich dat (ZIP s tabulkami pro Excel) vám pošleme v samostatném e-mailu. Pokud smazání nechcete, napište nám a účet obnovíme.${SIGNATURE}`
    );
  }
  return NextResponse.json({ ok: true, scheduledAt: scheduledAt.toISOString(), sessionsRevoked: revoked ?? 0, emailed });
}

/** Obnovení firmy v ochranné lhůtě: vrátí předchozí stav a zruší naplánované úlohy. Po definitivním smazání už nejde. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.delete");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);

  const { data: company } = await platformDb().from("companies").select("id, status, status_before_deletion").eq("id", id).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const back = isCompanyStatus(company.status_before_deletion) && company.status_before_deletion !== "pending_deletion" && company.status_before_deletion !== "deleted" ? company.status_before_deletion : "active";
  const r = await setCompanyStatus(a.ctx, id, back, {
    action: "company.restore",
    allowFrom: ["pending_deletion"],
    extra: { deletion_scheduled_at: null, deletion_reason: null, status_before_deletion: null },
  });
  if (!r.ok) return apiError(r.code, r.code === "bad_transition" ? "Firmu lze obnovit jen v ochranné lhůtě." : r.message, r.code === "not_found" ? 404 : 409);
  await cancelCompanyJobs(id, ["company.deletion.remind", "company.deletion.execute"]);
  await queueCompanyEmail(id, "Účet vaší firmy v Dodio byl obnoven", `Dobrý den,\n\núčet vaší firmy jsme obnovili, smazání je zrušeno. Můžete se znovu přihlásit.${SIGNATURE}`);
  return NextResponse.json({ ok: true, status: back });
}
