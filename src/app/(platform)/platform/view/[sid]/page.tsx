import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImpersonationBar } from "@/components/platform/ImpersonationBar";
import { Card, Empty, Pill, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDate } from "@/components/platform/format";
import { planName } from "@/components/platform/format";
import { resolveContext, writeAuditOnce } from "@/server/platform/auth";
import { isActive, loadCompanyView, loadSession } from "@/server/platform/impersonation";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dodio Super-admin – náhled firmy", robots: { index: false, follow: false } };

const DAYS = ["", "Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const ROLE: Record<string, string> = { admin: "Admin", manager: "Manažer", employee: "Zaměstnanec" };
const STAFF: Record<string, string> = { hr: "HR", accountant: "Účetní" };

/** Náhled firmy jen pro čtení (impersonace). Každé zobrazení se zapisuje do auditu jako via_impersonation. */
export default async function ImpersonationView({ params }: { params: Promise<{ sid: string }> }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "company.impersonate")) redirect("/login");
  const { sid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sid)) redirect("/companies");
  const session = await loadSession(r.ctx, sid);
  if (!session || !isActive(session)) redirect(session ? `/companies/${session.company_id}` : "/companies");
  const view = await loadCompanyView(session.company_id);
  if (!view) redirect("/companies");
  await writeAuditOnce(r.ctx, { action: "impersonation.view", companyId: session.company_id, companyLabel: `${view.company.name} (#${view.company.seq_id})`, viaImpersonation: true });

  return (
    <div className="min-h-screen bg-paper">
      <ImpersonationBar companyName={view.company.name} expiresAt={session.expires_at} companyId={session.company_id} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
        <div>
          <h1 className="font-display text-h1">{view.company.name}</h1>
          <p className="mt-1 text-sm text-muted">Firma č. {view.company.seq_id} · tarif {planName(view.company.plan)} · důvod náhledu: {session.reason}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Nastavení firmy">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-label text-muted">Pracovní dny</dt><dd>{view.company.work_days.map((d) => DAYS[d]).join(", ")}{view.company.weekend_operations ? " (víkendový provoz)" : ""}</dd></div>
              <div><dt className="text-label text-muted">Výchozí dovolená</dt><dd>{view.company.default_vacation_days} dní</dd></div>
              <div><dt className="text-label text-muted">Čeká na schválení</dt><dd>{view.pendingCount} žádostí v období</dd></div>
            </dl>
          </Card>
          <Card title={`Oddělení (${view.departments.length})`}>
            {view.departments.length === 0 ? <p className="text-sm text-muted">Žádná oddělení.</p> : (
              <ul className="space-y-1 text-sm">{view.departments.map((d) => <li key={d.name} className="flex justify-between"><span>{d.name}</span><span className="tabular-nums text-muted">{d.people}</span></li>)}</ul>
            )}
          </Card>
          <Card title="Typy absencí">
            <ul className="space-y-1.5 text-sm">
              {view.leaveTypes.map((t) => (
                <li key={t.label} className="flex items-center justify-between gap-2">
                  <span className={t.active ? "" : "text-muted line-through"}>{t.hidden ? "Soukromý typ (skrytý)" : t.label}</span>
                  <span className="text-caption text-muted">{t.requires_approval ? "schvaluje se" : "bez schvalování"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title={`Lidé (${view.people.length})`}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Jméno</th><th className={thClass}>E-mail</th><th className={thClass}>Role</th><th className={thClass}>Oddělení</th><th className={thClass}>Stav</th></tr></thead>
              <tbody>
                {view.people.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>{p.name}</td>
                    <td className={`${tdClass} text-muted`}>{p.email ?? "–"}</td>
                    <td className={tdClass}>{ROLE[p.role] ?? p.role}{p.staff_role ? ` · ${STAFF[p.staff_role] ?? p.staff_role}` : ""}</td>
                    <td className={tdClass}>{p.department ?? "–"}</td>
                    <td className={tdClass}>{p.active ? <Pill className="bg-teal-light text-teal-dark">Aktivní</Pill> : <Pill className="bg-rust-light text-rust-dark">Deaktivován</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Absence (týden zpět a 60 dní dopředu)">
          {view.absences.length === 0 ? <Empty>V tomto období žádné absence.</Empty> : (
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead><tr><th className={thClass}>Zaměstnanec</th><th className={thClass}>Typ</th><th className={thClass}>Od</th><th className={thClass}>Do</th><th className={thClass}>Stav</th></tr></thead>
                <tbody>
                  {view.absences.map((a, i) => (
                    <tr key={i}>
                      <td className={tdClass}>{a.person}</td>
                      <td className={`${tdClass} ${a.masked ? "text-muted" : ""}`}>{a.label}{a.half_day ? " (půl dne)" : ""}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDate(a.start_date)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDate(a.end_date)}</td>
                      <td className={tdClass}>{a.status === "approved" ? <Pill className="bg-teal-light text-teal-dark">Schváleno</Pill> : <Pill className="bg-warning-light text-warning-dark">Čeká</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
