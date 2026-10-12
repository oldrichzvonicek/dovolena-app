import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/rate-limit";
import { apiError, isSameOrigin, platformDb, requestMeta, writeAudit } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

const BAD_LOGIN = "Nesprávný e-mail nebo heslo.";

/** Krok 1 přihlášení: e-mail + heslo (Supabase Auth). Po úspěchu se pokračuje TOTP kódem (nebo jeho nastavením). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return apiError("bad_origin", "Požadavek pochází z cizí adresy.", 403);
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || email.length > 200 || password.length > 200) return apiError("invalid_input", "Vyplňte e-mail a heslo.", 400);

  const meta = requestMeta(req.headers);
  // Zámek: 5 pokusů na e-mail za 15 minut (a širší limit na IP proti procházení účtů).
  const allowed = (await allowRequest(`platform-login:${email}`, 5, 900)) && (await allowRequest(`platform-login-ip:${meta.ip}`, 30, 900));
  if (!allowed) {
    await writeAudit(null, { action: "auth.locked", result: "denied", details: { email }, actor: { userId: null, label: email }, meta });
    return apiError("locked", "Příliš mnoho pokusů. Zkuste to za 15 minut.", 429, { "Retry-After": "900" });
  }

  const supabase = await createRouteClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await writeAudit(null, { action: "auth.login_failed", result: "denied", details: { email }, actor: { userId: null, label: email }, meta });
    return apiError("invalid_credentials", BAD_LOGIN, 401);
  }

  const { data: admin } = await platformDb().from("platform_admins").select("active").eq("user_id", data.user.id).maybeSingle();
  if (!admin?.active) {
    // Účet zákazníka nebo vypnutý admin: stejná hláška jako u špatného hesla, ať se nedá zjistit, kdo je admin.
    await supabase.auth.signOut();
    await writeAudit(null, { action: "auth.login_denied", result: "denied", details: { email }, actor: { userId: null, label: email }, meta });
    return apiError("invalid_credentials", BAD_LOGIN, 401);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp ?? [];
  return NextResponse.json(verified.length > 0 ? { step: "totp", factorId: verified[0].id } : { step: "enroll" });
}
