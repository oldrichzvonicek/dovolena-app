import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyInviteToken } from "@/lib/invite-token";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Ověří pozvánkový odkaz ještě před tím, než si člověk vymyslí heslo — ať zjistí neplatný odkaz hned, ne až po odeslání. */
export async function GET(req: NextRequest) {
  if (!(await allowRequest(`invite-verify:ip:${clientIp(req.headers)}`, 60, 3600))) return tooManyRequests();
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verifyInviteToken(token);
  if (!email) return NextResponse.json({ ok: false, error: "Odkaz je neplatný nebo vypršel." }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite } = await admin.from("company_invites").select("id").eq("email", email).maybeSingle();
  if (!invite) return NextResponse.json({ ok: false, error: "Pozvánka už neplatí. Požádejte administrátora firmy o novou." }, { status: 404 });
  return NextResponse.json({ ok: true, email });
}
