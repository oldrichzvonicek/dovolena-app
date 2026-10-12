import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { setCompanyStatus } from "@/server/platform/status";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Obnovení provozu pozastavené firmy. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.suspend");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const r = await setCompanyStatus(a.ctx, id, "active", { action: "company.unsuspend", allowFrom: ["suspended"] });
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);
  return NextResponse.json({ ok: true });
}
