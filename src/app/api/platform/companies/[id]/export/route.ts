import { NextResponse } from "next/server";
import { apiError, authorize, platformDb, writeAudit } from "@/server/platform/auth";
import { companyLabel } from "@/server/platform/companies";
import { enqueueJob } from "@/server/platform/jobs";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Založí úlohu exportu dat firmy (ZIP s CSV a JSON). Export nikdy neběží v požadavku; stav sleduje stránka Úlohy. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize(req, "company.export");
  if (!a.ok) return a.res;
  const { id } = await params;
  if (!UUID.test(id)) return apiError("not_found", "Firma nebyla nalezena.", 404);
  const body = (await req.json().catch(() => ({}))) as { notify_owner?: unknown };
  const { data: company } = await platformDb().from("companies").select("id, name, seq_id, status").eq("id", id).maybeSingle();
  if (!company) return apiError("not_found", "Firma nebyla nalezena.", 404);
  if (company.status === "deleted") return apiError("company_locked", "Firma je smazaná, nemá co exportovat.", 409);
  const jobId = await enqueueJob("company.export", id, { notify: body.notify_owner === true, linkDays: 30 }, new Date(), a.ctx.userId);
  if (!jobId) return apiError("enqueue_failed", "Úlohu se nepodařilo založit.", 500);
  await writeAudit(a.ctx, { action: "company.export", companyId: id, companyLabel: companyLabel(company), details: { job_id: jobId, notify_owner: body.notify_owner === true } });
  return NextResponse.json({ ok: true, job_id: jobId });
}
