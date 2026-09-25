import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Podepsaný odkaz pro schválení / zamítnutí žádosti z e-mailu. Token nese jen ID žádosti a ID schvalovatele
 * a čas platnosti; podepsaný je HMAC-SHA256. Sám o sobě nic nerozhoduje — rozhodnutí proběhne až po potvrzení na
 * stránce a databáze znovu ověří oprávnění i stav žádosti (jednorázovost tedy zajišťuje stav „čeká“).
 */
export interface ApprovalPayload {
  /** ID žádosti. */
  r: string;
  /** ID schvalovatele. */
  a: string;
  /** Konec platnosti (unix sekundy). */
  exp: number;
}

export const APPROVAL_LINK_DAYS = 7;

function secret(): string {
  const s = process.env.APPROVAL_TOKEN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Chybí APPROVAL_TOKEN_SECRET (nebo SUPABASE_SERVICE_ROLE_KEY) pro podepisování odkazů.");
  return s;
}

const b64 = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest();

export function signApprovalToken(payload: ApprovalPayload, key: string = secret()): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(sign(body, key))}`;
}

/** Vrátí obsah tokenu, nebo null, když je podpis špatný, token poškozený nebo prošel. */
export function verifyApprovalToken(token: string, now: number = Date.now(), key: string = secret()): ApprovalPayload | null {
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
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ApprovalPayload;
    if (typeof p.r !== "string" || typeof p.a !== "string" || typeof p.exp !== "number") return null;
    return p.exp * 1000 > now ? p : null;
  } catch {
    return null;
  }
}

/** Token platný `days` dní od `now`. */
export function newApprovalToken(requestId: string, approverId: string, days: number = APPROVAL_LINK_DAYS, now: number = Date.now(), key?: string): string {
  return signApprovalToken({ r: requestId, a: approverId, exp: Math.floor(now / 1000) + days * 86400 }, key);
}
