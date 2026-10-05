import { NextResponse } from "next/server";
import { addDaysIso } from "@/lib/plan-change";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { nextInvoiceNumber, todayIso } from "@/server/platform/billing";
import { companyLabel } from "@/server/platform/companies";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PDF = 5 * 1024 * 1024;

/**
 * Vystavení faktury za službu (dnes to provozovatel dělá ručně v Supabase). Multipart: pole company_id, number (volitelné,
 * jinak další v řadě), issue_date, due_at, amount (celkem s DPH), vat a volitelný soubor PDF. Do faktury se uloží kopie odběratele.
 */
export async function POST(req: Request) {
  const a = await authorize(req, "billing.write");
  if (!a.ok) return a.res;
  const form = await req.formData().catch(() => null);
  if (!form) return apiError("invalid_input", "Neplatný formulář.", 400);

  const companyId = String(form.get("company_id") ?? "");
  if (!UUID.test(companyId)) return apiError("invalid_input", "Vyberte firmu.", 400);
  const issue = String(form.get("issue_date") || todayIso());
  const due = String(form.get("due_at") || addDaysIso(issue, 14));
  const amount = Number(String(form.get("amount") ?? "").replace(",", "."));
  const vat = Number(String(form.get("vat") || "0").replace(",", "."));
  if (!ISO.test(issue) || !ISO.test(due)) return apiError("invalid_input", "Datum vystavení a splatnosti musí být platná data.", 400);
  if (due < issue) return apiError("invalid_input", "Splatnost nemůže být před vystavením.", 400);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return apiError("invalid_input", "Částka musí být kladné číslo.", 400);
  if (!Number.isFinite(vat) || vat < 0 || vat > amount) return apiError("invalid_input", "DPH musí být od 0 do celkové částky.", 400);

  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, seq_id, name, status").eq("id", companyId).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);
  if (company.status === "deleted") return apiError("company_locked", "Firma je smazaná.", 409);

  const { data: existing } = await db.from("company_invoices").select("number");
  const numbers = (existing ?? []).map((r) => String(r.number));
  let number = String(form.get("number") ?? "").trim();
  if (number) {
    if (number.length > 30) return apiError("invalid_input", "Číslo faktury je příliš dlouhé.", 400);
    if (numbers.includes(number)) return apiError("duplicate", "Faktura s tímto číslem už existuje.", 409);
  } else {
    number = nextInvoiceNumber(numbers, Number(issue.slice(0, 4)));
  }

  const { data: billing } = await db.from("company_billing").select("billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip").eq("company_id", companyId).maybeSingle();
  const buyer = {
    name: billing?.billing_name || company.name,
    ico: billing?.billing_ico ?? null,
    dic: billing?.billing_dic ?? null,
    street: billing?.billing_street ?? null,
    city: billing?.billing_city ?? null,
    zip: billing?.billing_zip ?? null,
  };

  let filePath: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return apiError("invalid_input", "Soubor PDF může mít nejvýš 5 MB.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return apiError("invalid_input", "Soubor není PDF.", 400);
    filePath = `${companyId}/${number.replace(/[^\w.-]/g, "_")}.pdf`;
    const { error: upErr } = await db.storage.from("company-invoices").upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return apiError("upload_failed", "Soubor se nepodařilo nahrát.", 500);
  }

  const { data: invoice, error } = await db
    .from("company_invoices")
    .insert({ company_id: companyId, number, issue_date: issue, due_at: due, amount, vat, currency: "CZK", status: "issued", buyer_snapshot: buyer, file_url: filePath })
    .select("id, number")
    .single();
  if (error || !invoice) {
    if (filePath) await db.storage.from("company-invoices").remove([filePath]);
    await writeAudit(a.ctx, { action: "invoice.create", result: "error", companyId, companyLabel: companyLabel(company), details: { error: error?.message } });
    return apiError("insert_failed", "Fakturu se nepodařilo uložit.", 500);
  }
  await writeAudit(a.ctx, { action: "invoice.create", companyId, companyLabel: companyLabel(company), details: { number, amount, vat, due_at: due, withFile: !!filePath } });
  return NextResponse.json({ ok: true, id: invoice.id, number: invoice.number });
}
