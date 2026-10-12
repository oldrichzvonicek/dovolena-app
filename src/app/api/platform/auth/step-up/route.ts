import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/rate-limit";
import { apiError, authorize, issueStepUp, writeAudit } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

/** Akce, pro které se smí vydat step-up token. Rozšiřuje se s dalšími citlivými akcemi (smazání firmy, impersonace, ceny). */
const ALLOWED_ACTIONS = /^(team\.update|company\.delete|company\.impersonate):[0-9a-f-]{36}$|^pricing\.write:(free|basic|starter|pro)$/;

/**
 * Citlivá akce vyžaduje nový kód TOTP i při platné relaci. Vrací jednorázový token na 5 minut vázaný na konkrétní akci;
 * klient ho posílá v hlavičce X-Step-Up-Token.
 */
export async function POST(req: Request) {
  const a = await authorize(req, null);
  if (!a.ok) return a.res;
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; code?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (!ALLOWED_ACTIONS.test(action)) return apiError("invalid_action", "Pro tuto akci se ověření nevydává.", 400);
  if (!/^\d{6}$/.test(code)) return apiError("invalid_input", "Zadejte šestimístný kód.", 400);
  if (!(await allowRequest(`platform-stepup:${a.ctx.userId}`, 5, 900))) return apiError("locked", "Příliš mnoho pokusů. Zkuste to za 15 minut.", 429, { "Retry-After": "900" });

  const supabase = await createRouteClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return apiError("no_factor", "TOTP není nastavené.", 400);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    await writeAudit(a.ctx, { action: "auth.stepup_failed", result: "denied", details: { action } });
    return apiError("invalid_code", "Neplatný kód.", 401);
  }
  const { token, expiresAt } = await issueStepUp(a.ctx, action);
  await writeAudit(a.ctx, { action: "auth.stepup", details: { action } });
  return NextResponse.json({ token, expiresAt });
}
