import { NextResponse } from "next/server";
import { apiError, authorize, platformDb } from "@/server/platform/auth";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Odkaz na PDF právního dokumentu (podepsaný na 60 sekund). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "settings.write");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Dokument nebyl nalezen.", 404);
  const db = platformDb();
  const { data: doc } = await db.from("legal_documents").select("file_path").eq("id", id).maybeSingle();
  if (!doc?.file_path) return apiError("not_found", "K dokumentu není nahraný soubor.", 404);
  const { data, error } = await db.storage.from("legal-documents").createSignedUrl(doc.file_path, 60);
  if (error || !data) return apiError("sign_failed", "Odkaz se nepodařilo vytvořit.", 500);
  return NextResponse.json({ url: data.signedUrl });
}
