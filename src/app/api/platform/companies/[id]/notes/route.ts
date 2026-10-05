import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { companyLabel } from "@/server/platform/companies";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.read");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const { data } = await platformDb().from("platform_company_notes").select("id, author_label, body, created_at").eq("company_id", id).order("created_at", { ascending: false }).limit(100);
  return NextResponse.json({ notes: data ?? [] });
}

/** Interní poznámka k firmě (vidí ji jen provozovatel). Zdravotní údaje ani osobní data zaměstnanců do poznámek nepatří. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "notes.write");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 1 || text.length > 4000) return apiError("invalid_input", "Poznámka musí mít 1 až 4 000 znaků.", 400);

  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, seq_id, name").eq("id", id).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const { data: note, error } = await db
    .from("platform_company_notes")
    .insert({ company_id: id, author_id: a.ctx.userId, author_label: a.ctx.name || a.ctx.email, body: text })
    .select("id, author_label, body, created_at")
    .single();
  if (error || !note) return apiError("insert_failed", "Poznámku se nepodařilo uložit.", 500);
  await writeAudit(a.ctx, { action: "note.create", companyId: id, companyLabel: companyLabel(company), details: { length: text.length } });
  return NextResponse.json({ note });
}
