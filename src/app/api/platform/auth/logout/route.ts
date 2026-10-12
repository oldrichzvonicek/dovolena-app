import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, isSameOrigin, apiError, platformDb, resolveContext, writeAudit } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return apiError("bad_origin", "Požadavek pochází z cizí adresy.", 403);
  const r = await resolveContext();
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  if (sid) await platformDb().from("platform_admin_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sid).is("ended_at", null);
  if (r.ok) await writeAudit(r.ctx, { action: "auth.logout" });

  const supabase = await createRouteClient();
  await supabase.auth.signOut();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
