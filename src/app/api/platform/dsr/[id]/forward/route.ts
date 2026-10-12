import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { forwardDsr } from "@/server/platform/dsr";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Předá žádost firmě (správci údajů): admini firmy dostanou e-mail bez osobních údajů žadatele. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "gdpr.forward");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Žádost nebyla nalezena.", 404);
  const r = await forwardDsr(a.ctx, id);
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);
  return NextResponse.json({ ok: true, sent: r.sent });
}
