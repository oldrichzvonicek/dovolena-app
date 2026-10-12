import { NextResponse } from "next/server";
import { apiError, authorize, platformDb } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Odkaz na PDF faktury (podepsaný na 60 sekund, jako v aplikaci). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "billing.read");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Faktura nebyla nalezena.", 404);
  const db = platformDb();
  const { data: invoice } = await db.from("company_invoices").select("file_url").eq("id", id).maybeSingle();
  if (!invoice?.file_url) return apiError("not_found", "K faktuře není nahraný soubor.", 404);
  const { data, error } = await db.storage.from("company-invoices").createSignedUrl(invoice.file_url, 60);
  if (error || !data) return apiError("sign_failed", "Odkaz se nepodařilo vytvořit.", 500);
  return NextResponse.json({ url: data.signedUrl });
}
