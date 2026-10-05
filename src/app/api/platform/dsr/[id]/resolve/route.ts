import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { resolveDsr } from "@/server/platform/dsr";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Uzavře žádost jako vyřízenou (jen super-admin). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "gdpr.handle");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Žádost nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
  const r = await resolveDsr(a.ctx, id, note);
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);
  return NextResponse.json({ ok: true });
}
