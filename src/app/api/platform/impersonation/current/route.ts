import { NextResponse } from "next/server";
import { authorize } from "@/server/platform/auth";
import { endImpersonation } from "@/server/platform/impersonation";

export const dynamic = "force-dynamic";

/** Ukončí aktuální náhled firmy. */
export async function DELETE(req: Request) {
  const a = await authorize(req, null);
  if (!a.ok) return a.res;
  const ended = await endImpersonation(a.ctx, null);
  return NextResponse.json({ ok: true, ended });
}
