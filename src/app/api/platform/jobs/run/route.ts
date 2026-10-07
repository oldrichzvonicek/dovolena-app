import { NextResponse } from "next/server";
import { authorize, writeAudit } from "@/server/platform/auth";
import { recordMaintenance, runMaintenance } from "@/server/platform/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ruční spuštění plánovače (lokálně a při ladění): zpracuje úlohy z fronty a rozešle upomínky. V ostrém provozu to dělá cron. */
export async function POST(req: Request) {
  const a = await authorize(req, "settings.write");
  if (!a.ok) return a.res;
  const summary = await runMaintenance();
  await recordMaintenance(summary, a.ctx.userId, true);
  await writeAudit(a.ctx, { action: "jobs.run", details: { ...summary } });
  return NextResponse.json({ ok: true, ...summary });
}
