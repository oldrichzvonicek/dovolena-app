import { NextResponse } from "next/server";
import { apiError, authorize } from "@/server/platform/auth";
import { createDsr, isDsrType } from "@/server/platform/dsr";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Založí evidenci GDPR žádosti (lhůta 30 dní od přijetí). Bez osobních údajů žadatele. */
export async function POST(req: Request) {
  const a = await authorize(req, "gdpr.forward");
  if (!a.ok) return a.res;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const label = typeof body.subject_label === "string" ? body.subject_label.trim() : "";
  if (typeof body.company_id !== "string" || !UUID.test(body.company_id)) return apiError("invalid_input", "Vyberte firmu.", 400);
  if (!isDsrType(body.type)) return apiError("invalid_input", "Vyberte typ žádosti.", 400);
  if (label.length < 3 || label.length > 80) return apiError("invalid_input", "Popisek žadatele musí mít 3 až 80 znaků (bez jména a osobních údajů).", 400);
  if (/@|\d{6,}/.test(label)) return apiError("invalid_input", "Popisek nesmí obsahovat e-mail ani čísla, která vypadají jako osobní údaj.", 400);
  const received = typeof body.received_at === "string" && ISO.test(body.received_at) ? body.received_at : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });
  const r = await createDsr(a.ctx, { company_id: body.company_id, type: body.type, subject_label: label, received_at: received });
  if (!r.ok) return apiError("create_failed", r.message, 400);
  return NextResponse.json({ ok: true, id: r.id });
}
