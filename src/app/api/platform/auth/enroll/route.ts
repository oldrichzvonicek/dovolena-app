import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { apiError, isSameOrigin, resolveAdminIdentity } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

/** Nastavení TOTP při prvním přihlášení: založí faktor a vrátí QR kód a tajný klíč. Ověří ho až /auth/totp. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return apiError("bad_origin", "Požadavek pochází z cizí adresy.", 403);
  const id = await resolveAdminIdentity();
  if (!id.ok) return apiError("unauthenticated", "Nejste přihlášeni.", 401);

  const supabase = await createRouteClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp ?? []).length > 0) return apiError("already_enrolled", "TOTP už je nastavené. Zadejte kód z aplikace.", 409);

  // Nedokončené pokusy o nastavení se uklidí, ať se neplní seznam faktorů.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Dodio Super-admin ${Date.now()}` });
  if (error || !data) return apiError("enroll_failed", "Nepodařilo se založit TOTP. Zkuste to znovu.", 500);
  return NextResponse.json({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
}
