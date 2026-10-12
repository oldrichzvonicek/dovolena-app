import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { queueCompanyEmail, SIGNATURE } from "@/server/platform/email";
import { setCompanyStatus } from "@/server/platform/status";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Pozastavení účtu: firma zůstane čitelná, ale nic v ní nejde měnit (režim jen pro čtení). Data zůstávají. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.suspend");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown; notify?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (reason.length < 3) return apiError("invalid_input", "Uveďte důvod pozastavení.", 400);

  const r = await setCompanyStatus(a.ctx, id, "suspended", { action: "company.suspend", details: { reason }, allowFrom: ["active"] });
  if (!r.ok) return apiError(r.code, r.message, r.code === "not_found" ? 404 : 409);
  if (body.notify === true) {
    await queueCompanyEmail(id, "Účet Dodio je pozastaven", `Dobrý den,\n\núčet vaší firmy je dočasně v režimu jen pro čtení. Data zůstávají zachována a po vyřešení ho ihned obnovíme. Kontaktujte nás prosím.${SIGNATURE}`);
  }
  return NextResponse.json({ ok: true });
}
