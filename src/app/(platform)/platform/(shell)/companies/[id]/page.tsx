import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/platform/BackLink";
import { InvoicesTable, NewInvoiceDialog } from "@/components/platform/InvoiceActions";
import { NotesPanel, SubscriptionDialog } from "@/components/platform/CompanyActions";
import { CompanyStatusActions } from "@/components/platform/CompanyStatusActions";
import { Card, PageHeader, Pill, Stat } from "@/components/platform/ui";
import { COMPANY_STATUS, formatDate, formatDateTime, formatKc, planName } from "@/components/platform/format";
import { ADDONS, planByKey, userLimitOf } from "@/lib/plans";
import { resolveContext, writeAuditOnce } from "@/server/platform/auth";
import { ATTENTION_LABELS, companyLabel, loadCompany } from "@/server/platform/companies";
import { toInvoiceItems } from "@/server/platform/invoices";
import { actionLabel } from "@/server/platform/audit-query";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "company.read_billing")) redirect("/login");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const full = can(r.ctx.role, "company.read");
  const d = await loadCompany(id, { full });
  if (!d) notFound();
  const { company: c } = d;
  if (full) await writeAuditOnce(r.ctx, { action: "company.view", companyId: c.id, companyLabel: companyLabel(c) });

  const plan = planByKey(c.plan);
  const limit = userLimitOf(c.plan);
  const st = COMPANY_STATUS[c.status] ?? COMPANY_STATUS.active;
  const canPlan = can(r.ctx.role, "plan.change") && c.status !== "pending_deletion" && c.status !== "deleted";
  const canBillingWrite = can(r.ctx.role, "billing.write");
  const invoices = toInvoiceItems(d.invoices, new Map([[c.id, { id: c.id, name: c.name, seq_id: c.seq_id, plan: c.plan, billing_period: c.billing_period, plan_paid_until: c.plan_paid_until }]]));
  const addonNames = (c.addons ?? []).map((k) => ADDONS.find((a) => a.key === k)?.name ?? k);
  const b = d.billing;

  return (
    <>
      <BackLink label="Všechny firmy" fallbackHref="/companies" />
      <PageHeader
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>Firma č. {c.seq_id}</span>
            <Pill className={st.className}>{st.label}</Pill>
            {c.is_test && <span className="rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-muted">testovací</span>}
            <span>· založena {formatDate(c.created_at)}</span>
          </span>
        }
      />

      {c.attention.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {c.attention.map((a) => (
            <Pill key={a} className={a === "overdue" || a === "expired" || a === "over_limit" ? "bg-danger-light text-danger-dark" : "bg-warning-light text-warning-dark"}>{ATTENTION_LABELS[a]}</Pill>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tarif" value={plan.name} hint={c.billing_period === "yearly" ? "roční platba" : "měsíční platba"} />
        <Stat label="Zaplaceno do" value={c.plan_paid_until ? formatDate(c.plan_paid_until) : "–"} hint={plan.monthly === 0 ? "Free se neplatí" : c.plan_paid_until ? undefined : "platnost není evidována"} />
        <Stat label="Aktivní uživatelé" value={limit !== null ? `${c.users} / ${limit}` : c.users} hint={limit === null ? `bez limitu, ${plan.includedUsers ?? 0} v ceně` : full && d.usersInactive > 0 ? `+ ${d.usersInactive} deaktivovaných` : undefined} />
        <Stat label="MRR" value={c.mrr > 0 ? formatKc(c.mrr) : "–"} hint={c.discount_pct > 0 ? `sleva ${c.discount_pct} %` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Předplatné" actions={canPlan ? <SubscriptionDialog company={{ id: c.id, plan: c.plan, addons: c.addons ?? [], billing_period: c.billing_period, plan_paid_until: c.plan_paid_until, discount_pct: c.discount_pct, pending_plan: c.pending_plan, pending_plan_from: c.pending_plan_from, users: c.users }} /> : undefined}>
            {/* Tarif a Zaplaceno do jsou už ve Stat kartách nahoře — tady jen to, co tam není. */}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-label text-muted">Fakturační období</dt><dd>{c.billing_period === "yearly" ? "Roční" : "Měsíční"}</dd></div>
              <div><dt className="text-label text-muted">Doplňky</dt><dd>{addonNames.length > 0 ? addonNames.join(", ") : "žádné"}</dd></div>
              <div><dt className="text-label text-muted">Sleva</dt><dd>{c.discount_pct > 0 ? `${c.discount_pct} %` : "žádná"}</dd></div>
            </dl>
            {c.pending_plan && (
              <p className="mt-3 rounded bg-warning-light px-3 py-2 text-sm text-warning-dark">
                Naplánováno snížení na tarif <strong>{planName(c.pending_plan)}</strong> od {formatDate(c.pending_plan_from)}.
              </p>
            )}
          </Card>

          {full && (
            <Card title="Stav účtu a akce">
              <CompanyStatusActions
                companyId={c.id}
                companyName={c.name}
                status={c.status}
                deletionScheduledAt={c.deletion_scheduled_at}
                deletionReason={c.deletion_reason}
                can={{ suspend: can(r.ctx.role, "company.suspend"), delete: can(r.ctx.role, "company.delete"), impersonate: can(r.ctx.role, "company.impersonate"), export: can(r.ctx.role, "company.export") }}
              />
            </Card>
          )}

          <Card title="Faktury" actions={canBillingWrite ? <NewInvoiceDialog fixedCompany={{ id: c.id, name: c.name }} /> : undefined}>
            <InvoicesTable invoices={invoices} canWrite={canBillingWrite} />
          </Card>

          {full && (
            <Card title="Poznámky">
              <NotesPanel companyId={c.id} notes={d.notes} canWrite={can(r.ctx.role, "notes.write")} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Fakturační údaje">
            {b && (b.billing_name || b.billing_ico) ? (
              <dl className="space-y-2 text-sm">
                <div><dt className="text-label text-muted">Odběratel</dt><dd>{b.billing_name ?? c.name}</dd></div>
                <div><dt className="text-label text-muted">IČO / DIČ</dt><dd>{b.billing_ico ?? "–"} / {b.billing_dic ?? "–"}</dd></div>
                <div><dt className="text-label text-muted">Adresa</dt><dd>{[b.billing_street, [b.billing_zip, b.billing_city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "–"}</dd></div>
                <div><dt className="text-label text-muted">E-mail pro faktury</dt><dd className="break-all">{b.billing_email ?? "–"}</dd></div>
                <div><dt className="text-label text-muted">Způsob platby</dt><dd>{b.payment_method === "invoice" ? "Faktura" : b.payment_method ?? "–"}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-muted">Firma zatím nevyplnila fakturační údaje.</p>
            )}
          </Card>

          {full && (
            <Card title="Správci firmy">
              {d.admins.length === 0 ? (
                <p className="text-sm text-muted">Žádný správce.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.admins.map((a, i) => (
                    <li key={i}>
                      <div className="font-medium">{a.name}{!a.active && <span className="ml-2 text-caption text-muted">deaktivován</span>}</div>
                      <div className="break-all text-caption text-muted">{a.email ?? "bez e-mailu"}</div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-caption text-muted">Super-admin nečte data o absencích zaměstnanců, jen počty a správce firmy.</p>
            </Card>
          )}

          {full && (
            <Card title="Poslední akce">
              {d.activity.length === 0 ? (
                <p className="text-sm text-muted">Zatím nic.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.activity.map((a) => (
                    <li key={a.id}>
                      <div>{actionLabel(a.action)}{a.result !== "ok" && <span className="ml-1.5 text-danger-dark">({a.result})</span>}</div>
                      <div className="text-caption text-muted">{a.actor_label ?? "systém"} · {formatDateTime(a.created_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
              {can(r.ctx.role, "audit.read") && (
                <Link href={`/audit?company=${c.id}`} className="mt-3 inline-block text-caption text-teal-dark hover:underline">Zobrazit celý audit této firmy →</Link>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
