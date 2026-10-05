import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Card, Stat, Pill, AllGood, tableClass, thClass, tdClass } from "@/components/platform/ui";
import { formatKc, planName } from "@/components/platform/format";
import { platformDb, resolveContext } from "@/server/platform/auth";
import { countDueSoon } from "@/server/platform/dsr";
import { ATTENTION_LABELS, loadDashboard } from "@/server/platform/companies";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "company.read_billing")) redirect("/login");
  const s = await loadDashboard();
  const showOps = can(r.ctx.role, "gdpr.forward");
  const dsrSoon = showOps ? await countDueSoon() : 0;
  const { count: failedJobs } = can(r.ctx.role, "settings.write") ? await platformDb().from("platform_jobs").select("id", { count: "exact", head: true }).eq("status", "failed") : { count: 0 };

  return (
    <>
      <PageHeader title="Přehled" subtitle="Stav všech firem na jednom místě. Testovací firmy se do čísel nezapočítávají." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR (měsíční příjem)" value={formatKc(s.mrr)} hint="Aktivní firmy, roční platby přepočtené na měsíc" href="/companies?sort=mrr&dir=desc" />
        <Stat label="ARR (roční příjem)" value={formatKc(s.arr)} hint="MRR × 12" href="/companies?sort=mrr&dir=desc" />
        <Stat label="Firmy" value={s.companies} hint={`${s.paying} platících, ${s.free} na Free · ${s.newLast30Days} nových za 30 dní`} href="/companies" />
        <Stat label="Aktivní uživatelé" value={s.users} hint="Bez ukázkových účtů" href="/companies?sort=users&dir=desc" />
      </div>

      {((dsrSoon > 0) || (failedJobs ?? 0) > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dsrSoon > 0 && <Link href="/gdpr" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark hover:underline">GDPR žádosti se blížící lhůtou: {dsrSoon}</Link>}
          {(failedJobs ?? 0) > 0 && <Link href="/jobs" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark hover:underline">Selhané úlohy: {failedJobs}</Link>}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Vyžaduje pozornost" className="lg:col-span-2">
          {s.attention.length === 0 ? (
            <AllGood>Vše běží hladce — žádná firma nemá fakturu po splatnosti, končící platnost ani limit uživatelů.</AllGood>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>Firma</th>
                    <th className={thClass}>Tarif</th>
                    <th className={thClass}>Důvod</th>
                    <th className={`${thClass} text-right`}>MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {s.attention.map((c) => (
                    <tr key={c.id}>
                      <td className={tdClass}>
                        <Link href={`/companies/${c.id}`} className="font-medium text-teal-dark hover:underline">{c.name}</Link>
                        <span className="ml-1.5 text-caption text-muted">#{c.seq_id}</span>
                      </td>
                      <td className={tdClass}>{planName(c.plan)}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1">
                          {c.attention.map((a) => (
                            <Pill key={a} className={a === "overdue" || a === "expired" || a === "over_limit" ? "bg-danger-light text-danger-dark" : "bg-warning-light text-warning-dark"}>{ATTENTION_LABELS[a]}</Pill>
                          ))}
                        </div>
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{formatKc(c.mrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Podle tarifu">
            <table className={tableClass}>
              <tbody>
                {s.byPlan.map((p) => (
                  <tr key={p.key}>
                    <td className={tdClass}>{p.name}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.companies}</td>
                    <td className={`${tdClass} text-right tabular-nums text-muted`}>{formatKc(p.mrr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Stavy a faktury">
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Aktivní</span><span className="tabular-nums">{s.byStatus.active ?? 0}</span></li>
              <li className="flex justify-between"><span>Pozastavené</span><span className="tabular-nums">{s.byStatus.suspended ?? 0}</span></li>
              <li className="flex justify-between"><span>Ke smazání</span><span className="tabular-nums">{s.byStatus.pending_deletion ?? 0}</span></li>
              <li className="flex justify-between border-t border-line pt-1.5"><span>Faktury po splatnosti</span><span className={`tabular-nums ${s.overdueInvoices > 0 ? "font-semibold text-danger-dark" : ""}`}>{s.overdueInvoices}</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
