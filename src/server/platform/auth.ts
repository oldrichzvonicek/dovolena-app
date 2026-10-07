import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";
import { can, isPlatformRole, type Permission, type PlatformRole } from "./permissions";

/**
 * Přihlášení a oprávnění super-adminu. Admin účet je uživatel Supabase Auth s aktivním řádkem v platform_admins
 * (a bez řádku v profiles). Každý požadavek musí projít: session → aal2 (TOTP) → aktivní admin → platná platformní
 * relace (30 min nečinnosti, nejdéle 12 h) → oprávnění → zápis do auditu.
 */

export const SESSION_COOKIE = "platform_sid";
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/** Service-role klient — smí se používat jen v kódu adminu, po kontrole přihlášení. */
export const platformDb = () => createAdminClient();

export interface PlatformContext {
  userId: string;
  email: string;
  name: string;
  role: PlatformRole;
  sessionId: string;
  ip: string;
  userAgent: string;
  requestId: string;
}

export type ContextFailure = "no_session" | "not_admin" | "mfa_required" | "session_expired";

export interface AdminIdentity {
  user: User;
  admin: { user_id: string; email: string; name: string; role: PlatformRole };
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function requestMeta(h: Headers) {
  return { ip: clientIp(h), userAgent: (h.get("user-agent") ?? "").slice(0, 300), requestId: h.get("x-vercel-id") ?? randomBytes(8).toString("hex") };
}

/** Přihlášený uživatel, který je aktivním platformním adminem (bez ohledu na úroveň ověření — používá se při přihlašování). */
export async function resolveAdminIdentity(): Promise<{ ok: true; identity: AdminIdentity } | { ok: false; reason: "no_session" | "not_admin" }> {
  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "no_session" };
  const { data: admin } = await platformDb().from("platform_admins").select("user_id, email, name, role, active").eq("user_id", user.id).maybeSingle();
  if (!admin || !admin.active || !isPlatformRole(admin.role)) return { ok: false, reason: "not_admin" };
  return { ok: true, identity: { user, admin: { user_id: admin.user_id, email: admin.email, name: admin.name ?? "", role: admin.role } } };
}

/** Úplný kontext: identita + TOTP (aal2) + platná platformní relace. */
export async function resolveContext(): Promise<{ ok: true; ctx: PlatformContext } | { ok: false; reason: ContextFailure }> {
  const id = await resolveAdminIdentity();
  if (!id.ok) return id;

  const supabase = await createRouteClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return { ok: false, reason: "mfa_required" };

  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid) return { ok: false, reason: "session_expired" };
  const db = platformDb();
  const { data: session } = await db
    .from("platform_admin_sessions")
    .select("id, started_at, last_seen_at, ended_at")
    .eq("id", sid)
    .eq("admin_id", id.identity.admin.user_id)
    .maybeSingle();
  const now = Date.now();
  if (!session || session.ended_at || now - new Date(session.started_at).getTime() > MAX_SESSION_MS || now - new Date(session.last_seen_at).getTime() > IDLE_LIMIT_MS) {
    if (session && !session.ended_at) await db.from("platform_admin_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sid);
    return { ok: false, reason: "session_expired" };
  }
  if (now - new Date(session.last_seen_at).getTime() > 60_000) {
    await db.from("platform_admin_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sid);
  }

  const meta = requestMeta(await headers());
  const a = id.identity.admin;
  return { ok: true, ctx: { userId: a.user_id, email: a.email, name: a.name, role: a.role, sessionId: sid, ...meta } };
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditEntry {
  action: string;
  result?: "ok" | "denied" | "error";
  companyId?: string | null;
  companyLabel?: string | null;
  details?: Record<string, unknown>;
  actor?: { userId: string | null; label: string | null; actorType?: "admin" | "system" | "impersonation" };
  meta?: { ip?: string; userAgent?: string; requestId?: string };
  /** Akce provedená během náhledu firmy (impersonace). */
  viaImpersonation?: boolean;
}

/** Jediné místo, kde se zapisuje platformní audit. Chyba zápisu nesmí shodit akci, ale zůstane v logu serveru. */
export async function writeAudit(ctx: PlatformContext | null, entry: AuditEntry): Promise<void> {
  const { error } = await platformDb()
    .from("platform_audit_log")
    .insert({
      request_id: ctx?.requestId ?? entry.meta?.requestId ?? null,
      actor_type: entry.viaImpersonation ? "impersonation" : entry.actor?.actorType ?? (ctx ? "admin" : "system"),
      via_impersonation: entry.viaImpersonation ?? false,
      actor_id: ctx?.userId ?? entry.actor?.userId ?? null,
      actor_label: ctx ? ctx.email : entry.actor?.label ?? null,
      action: entry.action,
      result: entry.result ?? "ok",
      company_id: entry.companyId ?? null,
      company_label: entry.companyLabel ?? null,
      details: entry.details ?? {},
      ip: ctx?.ip ?? entry.meta?.ip ?? null,
      user_agent: ctx?.userAgent ?? entry.meta?.userAgent ?? null,
    });
  if (error) console.error("platform audit:", error.message);
}

/**
 * Jako writeAudit, ale stejná akce téhož admina nad toutéž firmou se v daném okně zapíše jen jednou. Pro „zobrazení“
 * (company.view, impersonation.view): jedno otevření stránky se kvůli obnovení po akcích a opakovanému renderu jinak zapisovalo
 * 6–7× za minutu a skutečné zásahy v logu zanikaly.
 */
export async function writeAuditOnce(ctx: PlatformContext, entry: AuditEntry, windowSeconds = 600): Promise<void> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  let q = platformDb().from("platform_audit_log").select("id", { head: true, count: "exact" }).eq("action", entry.action).eq("actor_id", ctx.userId).gte("created_at", since);
  q = entry.companyId ? q.eq("company_id", entry.companyId) : q.is("company_id", null);
  const { count } = await q;
  if ((count ?? 0) > 0) return;
  await writeAudit(ctx, entry);
}

// ---------------------------------------------------------------------------
// API pomocníci
// ---------------------------------------------------------------------------

export function apiError(code: string, message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}

/** Ochrana proti CSRF: změny smí přijít jen ze stejné adresy (prohlížeč u fetch vždy pošle Origin). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/**
 * Začátek každého chráněného handleru: relace + oprávnění. Zamítnutí se zapisuje do auditu.
 * `permission: null` = stačí být přihlášený admin.
 */
export async function authorize(req: Request, permission: Permission | null): Promise<{ ok: true; ctx: PlatformContext } | { ok: false; res: NextResponse }> {
  if (!isSameOrigin(req)) return { ok: false, res: apiError("bad_origin", "Požadavek pochází z cizí adresy.", 403) };
  const r = await resolveContext();
  if (!r.ok) {
    const map: Record<ContextFailure, [string, string, number]> = {
      no_session: ["unauthenticated", "Nejste přihlášeni.", 401],
      not_admin: ["forbidden", "Nemáte přístup.", 403],
      mfa_required: ["mfa_required", "Chybí ověření kódem TOTP.", 401],
      session_expired: ["session_expired", "Relace vypršela. Přihlaste se znovu.", 401],
    };
    const [code, message, status] = map[r.reason];
    return { ok: false, res: apiError(code, message, status) };
  }
  if (permission && !can(r.ctx.role, permission)) {
    await writeAudit(r.ctx, { action: `denied:${permission}`, result: "denied", details: { path: new URL(req.url).pathname } });
    return { ok: false, res: apiError("forbidden", "K této akci nemáte oprávnění.", 403) };
  }
  return { ok: true, ctx: r.ctx };
}

// ---------------------------------------------------------------------------
// Step-up: nový kód TOTP pro citlivou akci → jednorázový token na 5 minut vázaný na akci
// ---------------------------------------------------------------------------

export async function issueStepUp(ctx: PlatformContext, action: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + STEP_UP_TTL_MS).toISOString();
  const { error } = await platformDb().from("platform_stepup_tokens").insert({ admin_id: ctx.userId, action, token_hash: sha256(token), expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

/** Spotřebuje token (jen jednou, jen pro danou akci a admina, jen do vypršení). */
export async function consumeStepUp(ctx: PlatformContext, action: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const { data } = await platformDb()
    .from("platform_stepup_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .eq("admin_id", ctx.userId)
    .eq("action", action)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id");
  return (data?.length ?? 0) === 1;
}

export const STEP_UP_HEADER = "x-step-up-token";

/** Cookie s id platformní relace (httpOnly, SameSite=Strict — nesdílí se s aplikací). */
export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_SESSION_MS / 1000 };
}
