import { NextResponse } from "next/server";
import { STEP_UP_HEADER, apiError, authorize, consumeStepUp, writeAudit } from "@/server/platform/auth";
import { applyPriceChange, isPlanKey, loadPriceRows, validatePriceInput } from "@/server/platform/prices";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await authorize(req, "pricing.write");
  if (!a.ok) return a.res;
  return NextResponse.json({ plans: await loadPriceRows() });
}

/** Uloží novou verzi ceny tarifu (nový řádek v plans). Vyžaduje step-up token pro akci `pricing.write:<tarif>`. */
export async function POST(req: Request) {
  const a = await authorize(req, "pricing.write");
  if (!a.ok) return a.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isPlanKey(body.plan)) return apiError("invalid_input", "Neznámý tarif.", 400);
  if (body.apply_to !== "new_only" && body.apply_to !== "all_after_notice") return apiError("invalid_input", "Vyberte, na koho se změna vztahuje.", 400);
  const input = validatePriceInput(body);
  if ("error" in input) return apiError("invalid_input", input.error, 400);

  const action = `pricing.write:${body.plan}`;
  if (!(await consumeStepUp(a.ctx, action, req.headers.get(STEP_UP_HEADER)))) {
    await writeAudit(a.ctx, { action: "denied:step_up", result: "denied", details: { for: action } });
    return apiError("step_up_required", "Potvrďte akci novým kódem TOTP.", 403);
  }
  const r = await applyPriceChange(a.ctx, body.plan, input, body.apply_to);
  if (!r.ok) return apiError(r.code, r.message, r.code === "conflict" ? 409 : 500);
  return NextResponse.json({ ok: true, locked: r.locked, notified: r.notified, effectiveFrom: r.effectiveFrom });
}
