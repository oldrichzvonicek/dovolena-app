import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Podepsaný odkaz pro dokončení pozvánky e-mailem (`/api/invite/accept`). Nese jen e-mail a konec platnosti,
 * podepsané HMAC-SHA256 — stejný princip jako u odkazů pro schválení žádosti (viz approval-token.ts), sdílí i tajný klíč.
 * Doba platnosti je delší (14 dní), protože pozvánku člověk často neotevře hned.
 */
export interface InvitePayload {
  /** E-mail, kterému pozvánka patří. */
  e: string;
  /** Konec platnosti (unix sekundy). */
  exp: number;
}

export const INVITE_LINK_DAYS = 14;

function secret(): string {
  const s = process.env.APPROVAL_TOKEN_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production" && process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  throw new Error("Chybí APPROVAL_TOKEN_SECRET (min. 32 znaků) pro podepisování odkazů.");
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest();

export function signInviteToken(email: string, days: number = INVITE_LINK_DAYS, now: number = Date.now(), key: string = secret()): string {
  const body = b64(JSON.stringify({ e: email.trim().toLowerCase(), exp: Math.floor(now / 1000) + days * 86400 } satisfies InvitePayload));
  return `${body}.${b64(sign(body, key))}`;
}

/** Vrátí e-mail z tokenu, nebo null, když je podpis špatný, token poškozený nebo prošel. */
export function verifyInviteToken(token: string, now: number = Date.now(), key: string = secret()): string | null {
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = sign(body, key);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InvitePayload;
    if (typeof p.e !== "string" || typeof p.exp !== "number") return null;
    return p.exp * 1000 > now ? p.e : null;
  } catch {
    return null;
  }
}
