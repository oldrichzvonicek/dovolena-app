import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Omezení počtu požadavků na vlastní API (počítá databáze, viz rate_limit_hit v schema.sql).
 * Když databáze selže (např. funkce ještě není nasazená), požadavek se PROPUSTÍ — omezení nesmí shodit aplikaci.
 */
export async function allowRequest(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

/** IP adresa volajícího (za proxy z hlaviček); "unknown" nesdílí limit mezi lidmi, jen zpřísní ten jediný klíč. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function tooManyRequests(seconds = 60): NextResponse {
  return NextResponse.json({ error: "Příliš mnoho požadavků. Zkuste to za chvíli." }, { status: 429, headers: { "Retry-After": String(seconds) } });
}
