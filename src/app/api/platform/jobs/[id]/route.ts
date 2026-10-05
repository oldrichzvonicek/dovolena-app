import { NextResponse } from "next/server";
import { apiError, authorize, platformDb } from "@/server/platform/auth";
import { signedExportUrl } from "@/server/platform/export";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Stav úlohy. U hotového exportu vrací i odkaz ke stažení (platí 60 sekund). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, null);
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Úloha nebyla nalezena.", 404);
  const { data: job } = await platformDb().from("platform_jobs").select("id, type, company_id, status, attempts, error, result, run_at, created_at, finished_at").eq("id", id).maybeSingle();
  if (!job) return apiError("not_found", "Úloha nebyla nalezena.", 404);
  let downloadUrl: string | null = null;
  const path = (job.result as { path?: string } | null)?.path;
  if (job.type === "company.export" && job.status === "done" && path) downloadUrl = await signedExportUrl(path, 60);
  return NextResponse.json({ job, downloadUrl });
}
