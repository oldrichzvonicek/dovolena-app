import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyNpsToken } from "@/lib/nps-token";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const BUCKETS = ["detractor", "passive", "promoter"] as const;

/**
 * Klik na NPS tlačítko v e-mailu (src/app/api/cron/daily) — zaloguje náladu a vždy přesměruje na stejnou
 * stránku s odkazy na hodnocení, bez ohledu na odpověď (žádný selektivní filtr podle spokojenosti).
 */
export async function GET(req: NextRequest) {
  const dest = new URL("/hodnoceni", req.url);
  if (!(await allowRequest(`nps:ip:${clientIp(req.headers)}`, 20, 60))) return tooManyRequests();

  const { searchParams } = new URL(req.url);
  const payload = verifyNpsToken(searchParams.get("token") ?? "");
  // Nové e-maily posílají skóre 0–10, starší (už odeslané) přímo skupinu.
  const score = /^(10|\d)$/.test(searchParams.get("score") ?? "") ? Number(searchParams.get("score")) : null;
  const bucket = score === null ? (searchParams.get("bucket") ?? "") : score >= 9 ? "promoter" : score >= 7 ? "passive" : "detractor";
  if (!payload || !(BUCKETS as readonly string[]).includes(bucket)) return NextResponse.redirect(dest, 303);

  await createAdminClient()
    .from("nps_responses")
    .upsert({ company_id: payload.c, profile_id: payload.p, bucket }, { onConflict: "company_id" });

  return NextResponse.redirect(dest, 303);
}
