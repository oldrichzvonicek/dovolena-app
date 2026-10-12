import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/rate-limit";
import { SESSION_COOKIE, apiError, isSameOrigin, platformDb, requestMeta, resolveAdminIdentity, sessionCookieOptions, writeAudit, type PlatformContext } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

/** Krok 2 přihlášení: kód TOTP (nebo potvrzení nově nastaveného TOTP). Po úspěchu vznikne platformní relace. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return apiError("bad_origin", "Požadavek pochází z cizí adresy.", 403);
  const id = await resolveAdminIdentity();
  if (!id.ok) return apiError("unauthenticated", "Přihlaste se prosím znovu.", 401);

  const body = (await req.json().catch(() => ({}))) as { factorId?: unknown; code?: unknown };
  const factorId = typeof body.factorId === "string" ? body.factorId : "";
  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (!factorId || !/^\d{6}$/.test(code)) return apiError("invalid_input", "Zadejte šestimístný kód.", 400);

  const meta = requestMeta(req.headers);
  const actor = { userId: id.identity.user.id, label: id.identity.admin.email };
  if (!(await allowRequest(`platform-totp:${id.identity.user.id}`, 5, 900))) {
    await writeAudit(null, { action: "auth.locked", result: "denied", actor, meta });
    return apiError("locked", "Příliš mnoho pokusů. Zkuste to za 15 minut.", 429, { "Retry-After": "900" });
  }

  const supabase = await createRouteClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    await writeAudit(null, { action: "auth.totp_failed", result: "denied", actor, meta });
    return apiError("invalid_code", "Neplatný kód. Zkontrolujte čas v telefonu a zkuste to znovu.", 401);
  }

  const db = platformDb();
  const { data: session, error: sessionError } = await db
    .from("platform_admin_sessions")
    .insert({ admin_id: id.identity.user.id, ip: meta.ip, user_agent: meta.userAgent })
    .select("id")
    .single();
  if (sessionError || !session) return apiError("session_failed", "Nepodařilo se založit relaci.", 500);
  (await cookies()).set(SESSION_COOKIE, session.id, sessionCookieOptions());
  await db.from("platform_admins").update({ last_login_at: new Date().toISOString() }).eq("user_id", id.identity.user.id);

  const ctx: PlatformContext = { userId: id.identity.user.id, email: id.identity.admin.email, name: id.identity.admin.name, role: id.identity.admin.role, sessionId: session.id, ...meta };
  await writeAudit(ctx, { action: "auth.login" });
  return NextResponse.json({ ok: true });
}
