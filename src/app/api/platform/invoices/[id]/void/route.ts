import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { companyLabel } from "@/server/platform/companies";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Storno vystavené faktury. Faktura se nemaže (účetní doklad), jen změní stav; zaplacenou fakturu stornovat nejde. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "billing.write");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  const db = platformDb();
  const { data: invoice } = await db.from("company_invoices").select("id, company_id, number, status").eq("id", id).maybeSingle();
  if (!invoice) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  if (invoice.status !== "issued") return apiError("bad_state", "Stornovat lze jen vystavenou fakturu.", 409);
  const { data: company } = await db.from("companies").select("id, seq_id, name").eq("id", invoice.company_id).maybeSingle();
  const { data: done } = await db.from("company_invoices").update({ status: "void" }).eq("id", id).eq("status", "issued").select("id");
  if ((done?.length ?? 0) !== 1) return apiError("bad_state", "Fakturu se nepodařilo stornovat.", 409);
  await writeAudit(a.ctx, { action: "invoice.void", companyId: invoice.company_id, companyLabel: company ? companyLabel(company) : null, details: { number: invoice.number } });
  return NextResponse.json({ ok: true });
}
