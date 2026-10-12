import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ["terms", "dpa", "privacy"];
const MAX_PDF = 10 * 1024 * 1024;

/** Nová verze právního dokumentu (VOP, DPA, zásady). Multipart: type, version, effective_from, note a volitelné PDF. */
export async function POST(req: Request) {
  const a = await authorize(req, "settings.write");
  if (!a.ok) return a.res;
  const form = await req.formData().catch(() => null);
  if (!form) return apiError("invalid_input", "Neplatný formulář.", 400);
  const type = String(form.get("type") ?? "");
  const version = String(form.get("version") ?? "").trim();
  const effective = String(form.get("effective_from") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || null;
  if (!TYPES.includes(type)) return apiError("invalid_input", "Vyberte typ dokumentu.", 400);
  if (version.length < 1 || version.length > 30) return apiError("invalid_input", "Verze musí mít 1 až 30 znaků.", 400);
  if (!ISO.test(effective)) return apiError("invalid_input", "Zadejte datum účinnosti.", 400);

  const db = platformDb();
  let path: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF) return apiError("invalid_input", "Soubor PDF může mít nejvýš 10 MB.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") return apiError("invalid_input", "Soubor není PDF.", 400);
    path = `${type}/${version.replace(/[^\w.-]/g, "_")}.pdf`;
    const { error: upErr } = await db.storage.from("legal-documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return apiError("upload_failed", "Soubor se nepodařilo nahrát (existuje už tato verze?).", 409);
  }
  const { data, error } = await db.from("legal_documents").insert({ type, version, effective_from: effective, file_path: path, note, created_by: a.ctx.userId }).select("id").single();
  if (error || !data) {
    if (path) await db.storage.from("legal-documents").remove([path]);
    return apiError(error?.code === "23505" ? "duplicate" : "insert_failed", error?.code === "23505" ? "Tato verze dokumentu už existuje." : "Dokument se nepodařilo uložit.", error?.code === "23505" ? 409 : 500);
  }
  await writeAudit(a.ctx, { action: "legal.create", details: { type, version, effective_from: effective, withFile: !!path } });
  return NextResponse.json({ ok: true, id: data.id });
}
