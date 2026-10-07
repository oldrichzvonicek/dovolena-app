import { platformDb, writeAudit } from "./auth";
import { loadOverview, refreshActivity } from "./companies";
import { runDunning, type DunningSummary } from "./dunning";
import { SIGNATURE, czDate, queueCompanyEmail } from "./email";
import { buildCompanyExport, latestExportPath, signedExportUrl, storeCompanyExport } from "./export";
import { purgeCompanyStep } from "./purge";

/**
 * Fronta dlouhých úloh (platform_jobs). Nikdy neběží v HTTP požadavku uživatele: zapisují se sem a zpracovává je
 * /api/cron/platform-jobs (pg_cron / plánovač) nebo tlačítko „Spustit teď“ na stránce Úlohy. Převzetí je atomické
 * (platform_claim_jobs), takže se úloha nespustí dvakrát.
 */
export type JobType = "company.export" | "company.deletion.remind" | "company.deletion.execute" | "plans.unlock";

export interface JobRow {
  id: string;
  type: string;
  company_id: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  run_at: string;
  attempts: number;
  error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export const JOB_LABELS: Record<string, string> = {
  "company.export": "Export dat firmy",
  "company.deletion.remind": "Připomenutí smazání",
  "company.deletion.execute": "Smazání firmy",
  "plans.unlock": "Uvolnění zamčené ceny",
  "maintenance.run": "Běh plánovače",
};

const MAX_ATTEMPTS: Record<string, number> = { "company.deletion.execute": 30 };
const DEFAULT_ATTEMPTS = 3;

export async function enqueueJob(type: JobType, companyId: string | null, payload: Record<string, unknown>, runAt: Date, createdBy: string | null): Promise<string | null> {
  const { data, error } = await platformDb()
    .from("platform_jobs")
    .insert({ type, company_id: companyId, payload, run_at: runAt.toISOString(), created_by: createdBy })
    .select("id")
    .single();
  if (error) {
    console.error("platform job:", error.message);
    return null;
  }
  return data.id;
}

async function handle(job: JobRow): Promise<{ result: Record<string, unknown>; again?: boolean }> {
  const db = platformDb();
  const companyId = job.company_id;
  switch (job.type) {
    case "company.export": {
      if (!companyId) throw new Error("Chybí firma.");
      const { zip, counts } = await buildCompanyExport(companyId);
      const path = await storeCompanyExport(companyId, zip);
      let emailed = 0;
      if (job.payload.notify) {
        const days = Number(job.payload.linkDays) || 30;
        const url = await signedExportUrl(path, days * 86_400);
        if (url) {
          emailed = await queueCompanyEmail(
            companyId,
            "Export dat vaší firmy z Dodio je připravený",
            `Dobrý den,\n\npřipravili jsme export dat vaší firmy (ZIP s tabulkami pro Excel a nastavením). Stáhnete ho zde:\n\n${url}\n\nOdkaz platí ${days} dní. Soubor obsahuje osobní údaje zaměstnanců, uchovávejte ho zabezpečeně.${SIGNATURE}`
          );
        }
      }
      return { result: { path, bytes: zip.byteLength, counts, emailed } };
    }
    case "company.deletion.remind": {
      if (!companyId) throw new Error("Chybí firma.");
      const { data: c } = await db.from("companies").select("status, deletion_scheduled_at").eq("id", companyId).maybeSingle();
      if (!c || c.status !== "pending_deletion") return { result: { skipped: "not_pending" } };
      const path = await latestExportPath(companyId);
      const days = Math.max(1, Math.ceil((new Date(c.deletion_scheduled_at).getTime() - Date.now()) / 86_400_000));
      const url = path ? await signedExportUrl(path, 7 * 86_400) : null;
      const sent = await queueCompanyEmail(
        companyId,
        `Vaše data v Dodio budou za ${days} dní smazána`,
        `Dobrý den,\n\nÚčet vaší firmy je naplánovaný ke smazání dne ${czDate(c.deletion_scheduled_at)}. Po tomto dni už nepůjdou data obnovit.${url ? `\n\nExport dat si můžete stáhnout zde (odkaz platí 7 dní):\n${url}` : ""}\n\nPokud smazání nechcete, napište nám a účet obnovíme.${SIGNATURE}`
      );
      return { result: { sent } };
    }
    case "company.deletion.execute": {
      if (!companyId) throw new Error("Chybí firma.");
      const p = await purgeCompanyStep(companyId);
      return { result: { ...p }, again: !p.done };
    }
    case "plans.unlock": {
      const oldId = String(job.payload.old_plan_id ?? "");
      if (!oldId) throw new Error("Chybí původní ceník.");
      const { data } = await db.from("companies").update({ locked_plan_id: null }).eq("locked_plan_id", oldId).select("id");
      return { result: { unlocked: data?.length ?? 0 } };
    }
    default:
      throw new Error(`Neznámý typ úlohy: ${job.type}`);
  }
}

export interface JobsSummary {
  ran: number;
  failed: number;
  done: number;
}

export async function runDueJobs(limit = 5): Promise<JobsSummary> {
  const db = platformDb();
  const { data: claimed, error } = await db.rpc("platform_claim_jobs", { p_limit: limit });
  if (error) throw new Error(error.message);
  const summary: JobsSummary = { ran: 0, failed: 0, done: 0 };
  for (const job of (claimed ?? []) as JobRow[]) {
    summary.ran++;
    try {
      const { result, again } = await handle(job);
      if (again) {
        await db.from("platform_jobs").update({ status: "pending", run_at: new Date().toISOString(), result, error: null }).eq("id", job.id);
      } else {
        await db.from("platform_jobs").update({ status: "done", result, error: null, finished_at: new Date().toISOString() }).eq("id", job.id);
        summary.done++;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const exhausted = job.attempts >= (MAX_ATTEMPTS[job.type] ?? DEFAULT_ATTEMPTS);
      await db
        .from("platform_jobs")
        .update(exhausted ? { status: "failed", error: message, finished_at: new Date().toISOString() } : { status: "pending", error: message, run_at: new Date(Date.now() + 5 * 60_000).toISOString() })
        .eq("id", job.id);
      if (exhausted) {
        summary.failed++;
        await writeAudit(null, { action: "job.failed", result: "error", companyId: job.company_id, details: { type: job.type, error: message } });
      }
    }
  }
  return summary;
}

/** Celý běh plánovače: úlohy z fronty + upomínky po splatnosti + přepočet poslední aktivity firem (zápisy jen tady, nikdy z běžného čtení stránky Firmy). */
export async function runMaintenance(): Promise<{ jobs: JobsSummary; dunning: DunningSummary; activityUpdated: number }> {
  const jobs = await runDueJobs(5);
  const dunning = await runDunning();
  const activityUpdated = await refreshActivity(await loadOverview());
  return { jobs, dunning, activityUpdated };
}

export type MaintenanceSummary = Awaited<ReturnType<typeof runMaintenance>>;

/**
 * Zapíše běh plánovače do historie úloh. Ruční spuštění (force) se zapíše vždy, běh z cronu jen když se opravdu něco stalo,
 * ať se frontou nezahltí prázdné záznamy každých pár minut.
 */
export async function recordMaintenance(summary: MaintenanceSummary, createdBy: string | null, force: boolean): Promise<void> {
  const didSomething = summary.jobs.ran > 0 || summary.dunning.reminders > 0 || summary.dunning.suspended > 0 || summary.activityUpdated > 0;
  if (!force && !didSomething) return;
  const now = new Date().toISOString();
  const { error } = await platformDb().from("platform_jobs").insert({
    type: "maintenance.run",
    payload: { manual: force },
    status: "done",
    run_at: now,
    attempts: 1,
    result: summary as unknown as Record<string, unknown>,
    created_by: createdBy,
    started_at: now,
    finished_at: now,
  });
  if (error) console.error("platform job history:", error.message);
}

export async function cancelCompanyJobs(companyId: string, types: JobType[]): Promise<void> {
  await platformDb().from("platform_jobs").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("company_id", companyId).in("type", types).eq("status", "pending");
}
