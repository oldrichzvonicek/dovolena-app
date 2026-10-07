import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/email";
import { recordMaintenance, runMaintenance } from "@/server/platform/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Plánovač super-adminu: zpracuje úlohy z fronty platform_jobs (exporty, mazání firem, uvolnění cen) a rozešle upomínky
 * po splatnosti. Volá ho pg_cron / plánovač s hlavičkou Authorization: Bearer CRON_SECRET (viz DEPLOY.md, kap. 6).
 * Dostupný jen na hostu adminu a cronu (viz src/middleware.ts).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runMaintenance();
  await recordMaintenance(summary, null, false);
  return NextResponse.json(summary);
}
