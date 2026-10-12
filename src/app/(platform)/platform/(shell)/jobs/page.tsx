import Link from "next/link";
import { redirect } from "next/navigation";
import { DownloadExportButton, RunJobsButton } from "@/components/platform/JobsControls";
import { Card, Empty, PageHeader, Pill, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDateTime } from "@/components/platform/format";
import { platformDb, resolveContext } from "@/server/platform/auth";
import { JOB_LABELS, type JobRow } from "@/server/platform/jobs";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Čeká", className: "bg-sky-light text-sky-dark" },
  running: { label: "Běží", className: "bg-warning-light text-warning-dark" },
  done: { label: "Hotovo", className: "bg-teal-light text-teal-dark" },
  failed: { label: "Selhalo", className: "bg-danger-light text-danger-dark" },
  cancelled: { label: "Zrušeno", className: "bg-rust-light text-rust-dark" },
};

function describe(job: JobRow): string {
  const r = job.result as Record<string, unknown> | null;
  if (job.error) return job.error;
  if (!r) return "";
  if (job.type === "company.export") return `${Math.round(Number(r.bytes ?? 0) / 1024)} kB${r.emailed ? `, e-mail odeslán (${r.emailed})` : ""}`;
  if (job.type === "company.deletion.execute") return r.skipped ? `přeskočeno (${r.skipped})` : `smazáno účtů: ${r.deletedUsers ?? 0}${r.done ? ", firma smazána" : ", pokračuje"}`;
  if (job.type === "company.deletion.remind") return r.skipped ? "přeskočeno" : `e-mail odeslán (${r.sent ?? 0})`;
  if (job.type === "plans.unlock") return `uvolněno firem: ${r.unlocked ?? 0}`;
  if (job.type === "maintenance.run") {
    const m = r as { jobs?: { ran?: number; done?: number; failed?: number }; dunning?: { reminders?: number; suspended?: number }; activityUpdated?: number };
    return `úlohy ${m.jobs?.ran ?? 0} (hotovo ${m.jobs?.done ?? 0}, selhalo ${m.jobs?.failed ?? 0}), upomínky ${m.dunning?.reminders ?? 0}, pozastaveno ${m.dunning?.suspended ?? 0}, aktivita ${m.activityUpdated ?? 0} firem`;
  }
  return "";
}

const PAGE_SIZE = 30;

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "settings.write")) redirect("/login");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const offset = (page - 1) * PAGE_SIZE;
  const db = platformDb();
  const { data, count } = await db.from("platform_jobs").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  const jobs = (data ?? []) as JobRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const { data: companies } = await db.from("companies").select("id, name, seq_id").in("id", Array.from(new Set(jobs.map((j) => j.company_id).filter((x): x is string => !!x))));
  const byId = new Map((companies ?? []).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Úlohy"
        subtitle="Fronta dlouhých operací: exporty, mazání firem, uvolnění cen. Na ostrém provozu je zpracovává plánovač (viz DEPLOY.md), tady je jde spustit ručně."
        actions={<RunJobsButton />}
      />
      <Card>
        {jobs.length === 0 ? (
          <Empty>Zatím žádné úlohy. Vzniknou při exportu, plánovaném smazání firmy nebo změně cen.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Úloha</th>
                  <th className={thClass}>Firma</th>
                  <th className={thClass}>Stav</th>
                  <th className={thClass}>Naplánováno</th>
                  <th className={thClass}>Pokusy</th>
                  <th className={thClass}>Výsledek</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const st = STATUS[j.status] ?? STATUS.pending;
                  const c = j.company_id ? byId.get(j.company_id) : null;
                  return (
                    <tr key={j.id}>
                      <td className={tdClass}>{JOB_LABELS[j.type] ?? j.type}</td>
                      <td className={tdClass}>{c ? <Link href={`/companies/${j.company_id}`} className="text-teal-dark hover:underline">{c.name} <span className="text-caption text-muted">#{c.seq_id}</span></Link> : "–"}</td>
                      <td className={tdClass}><Pill className={st.className}>{st.label}</Pill></td>
                      <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(j.run_at)}</td>
                      <td className={`${tdClass} tabular-nums`}>{j.attempts}</td>
                      <td className={`${tdClass} max-w-xs text-caption ${j.error ? "text-danger-dark" : "text-muted"}`}>
                        {describe(j)}
                        {j.type === "company.export" && j.status === "done" && (j.result as { path?: string } | null)?.path && <div><DownloadExportButton jobId={j.id} /></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Stránkování">
          <span className="text-muted">Strana {Math.min(page, pages)} z {pages} ({total} úloh)</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/jobs?page=${page - 1}`} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Novější</Link>}
            {page < pages && <Link href={`/jobs?page=${page + 1}`} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Starší</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
