import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { companyLabel } from "@/server/platform/companies";
import { todayIso } from "@/server/platform/billing";
import { planSubscriptionChange, type SubscriptionRequest } from "@/server/platform/subscription";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Změna tarifu, doplňků, platnosti a slevy firmy. Zápis jde přes service role (auth.uid() je null), takže projde
 * triggerem guard_company_update, který tyto sloupce zamyká před adminem firmy.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "plan.change");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);

  const body = (await req.json().catch(() => null)) as (SubscriptionRequest & { reason?: unknown }) | null;
  if (!body || typeof body !== "object") return apiError("invalid_input", "Neplatný požadavek.", 400);
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";

  const db = platformDb();
  const { data: company } = await db
    .from("companies")
    .select("id, seq_id, name, plan, addons, billing_period, plan_paid_until, pending_plan, pending_plan_from, discount_pct, status")
    .eq("id", id)
    .maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);
  if (company.status === "deleted" || company.status === "pending_deletion") return apiError("company_locked", "Firma je určená ke smazání, změnu tarifu nelze provést.", 409);

  const plan = planSubscriptionChange({ ...company, discount_pct: Number(company.discount_pct ?? 0) }, body, todayIso());
  if ("error" in plan) return apiError("invalid_input", plan.error, 400);
  if (Object.keys(plan.changes).length === 0) return NextResponse.json({ ok: true, unchanged: true });

  const { error } = await db.from("companies").update(plan.update).eq("id", id);
  if (error) {
    await writeAudit(a.ctx, { action: "plan.change", result: "error", companyId: id, companyLabel: companyLabel(company), details: { error: error.message } });
    return apiError("update_failed", "Změnu se nepodařilo uložit.", 500);
  }
  await writeAudit(a.ctx, {
    action: "plan.change",
    companyId: id,
    companyLabel: companyLabel(company),
    details: { changes: plan.changes, kind: plan.kind, scheduled: plan.scheduled, scheduledFrom: plan.scheduledFrom, reason: reason || undefined },
  });
  return NextResponse.json({ ok: true, kind: plan.kind, scheduled: plan.scheduled, scheduledFrom: plan.scheduledFrom });
}
