import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { loadOverview } from "@/server/platform/companies";
import { currentRows, isPlanKey, loadPriceRows, previewPriceChange, validatePriceInput } from "@/server/platform/prices";

export const dynamic = "force-dynamic";

/** Náhled dopadu změny ceny: kolika firmám, o kolik se změní MRR a od kdy. Nic neukládá; obrazovka „Potvrzení změny cen“ ho volá před uložením. */
export async function POST(req: Request) {
  const a = await authorize(req, "pricing.write");
  if (!a.ok) return a.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isPlanKey(body.plan)) return apiError("invalid_input", "Neznámý tarif.", 400);
  if (body.apply_to !== "new_only" && body.apply_to !== "all_after_notice") return apiError("invalid_input", "Vyberte, na koho se změna vztahuje.", 400);
  const input = validatePriceInput(body);
  if ("error" in input) return apiError("invalid_input", input.error, 400);

  const today = todayIso();
  const oldRow = currentRows(await loadPriceRows(), today).get(body.plan);
  if (!oldRow) return apiError("no_price", "Tarif nemá v ceníku výchozí cenu.", 409);
  const overview = await loadOverview();
  const preview = previewPriceChange(overview.map((c) => ({ id: c.id, plan: c.plan, addons: c.addons, billing_period: c.billing_period, users: c.users, discount_pct: c.discount_pct, is_test: c.is_test, status: c.status, locked_plan_id: c.locked_plan_id })), body.plan, oldRow, input, body.apply_to, today);
  return NextResponse.json({ preview });
}
