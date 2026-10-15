import { timingSafeEqual } from "node:crypto";
import { b64, sign, secret } from "./approval-token";

/**
 * Podepsaný odkaz pro NPS otázku v e-mailu po pozitivním momentu (30 dní používání nebo 20 schválených
 * žádostí) — stejný princip jako approval-token.ts, jen jiný náklad (firma + příjemce místo žádosti).
 */
export interface NpsPayload {
  c: string; // company id
  p: string; // profile id (příjemce)
  exp: number;
}

export const NPS_LINK_DAYS = 30;

export function signNpsToken(payload: NpsPayload, key: string = secret()): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${b64(sign(body, key))}`;
}

/** Vrátí obsah tokenu, nebo null, když je podpis špatný, token poškozený nebo prošel. */
export function verifyNpsToken(token: string, now: number = Date.now(), key: string = secret()): NpsPayload | null {
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
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as NpsPayload;
    if (typeof p.c !== "string" || typeof p.p !== "string" || typeof p.exp !== "number") return null;
    return p.exp * 1000 > now ? p : null;
  } catch {
    return null;
  }
}

export function newNpsToken(companyId: string, profileId: string, days: number = NPS_LINK_DAYS, now: number = Date.now(), key?: string): string {
  return signNpsToken({ c: companyId, p: profileId, exp: Math.floor(now / 1000) + days * 86400 }, key);
}
