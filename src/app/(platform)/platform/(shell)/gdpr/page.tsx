import Link from "next/link";
import { redirect } from "next/navigation";
import { DsrRowActions, NewDsrDialog } from "@/components/platform/DsrControls";
import { Card, Empty, PageHeader, Pill, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDate } from "@/components/platform/format";
import { platformDb, resolveContext } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { DSR_STATUS_LABELS, DSR_TYPE_LABELS, DSR_WARNING_DAYS, daysLeft, isDueSoon, loadDsr } from "@/server/platform/dsr";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

export default async function GdprPage() {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "gdpr.forward")) redirect("/login");
  const [rows, { data: companies }] = await Promise.all([loadDsr(), platformDb().from("companies").select("id, name, seq_id").neq("status", "deleted").order("name")]);
  const today = todayIso();
  const open = rows.filter((x) => x.status !== "resolved");
  const done = rows.filter((x) => x.status === "resolved");
  const canForward = can(r.ctx.role, "gdpr.forward");
  const canResolve = can(r.ctx.role, "gdpr.handle");

  const table = (list: typeof rows) => (
    <div className="overflow-x-auto">
      <table className={tableClass}>
        <thead>
          <tr>
            <th className={thClass}>Firma</th>
            <th className={thClass}>Typ</th>
            <th className={thClass}>Žadatel</th>
            <th className={thClass}>Přijato</th>
            <th className={thClass}>Lhůta</th>
            <th className={thClass}>Stav</th>
            <th className={thClass}><span className="sr-only">Akce</span></th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => {
            const left = daysLeft(x.due_at, today);
            const soon = isDueSoon(x, today);
            return (
              <tr key={x.id}>
                <td className={tdClass}><Link href={`/companies/${x.company_id}`} className="text-teal-dark hover:underline">{x.company_name}</Link> <span className="text-caption text-muted">#{x.company_seq}</span></td>
                <td className={tdClass}>{DSR_TYPE_LABELS[x.type]}</td>
                <td className={tdClass}>{x.subject_label}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{formatDate(x.received_at)}</td>
                <td className={`${tdClass} whitespace-nowrap`}>
                  {formatDate(x.due_at)}
                  {x.status !== "resolved" && <div className={`text-caption ${soon ? "font-semibold text-danger-dark" : "text-muted"}`}>{left >= 0 ? `zbývá ${left} dní` : `po lhůtě o ${-left} dní`}</div>}
                </td>
                <td className={tdClass}><Pill className={x.status === "resolved" ? "bg-teal-light text-teal-dark" : x.status === "forwarded" ? "bg-sky-light text-sky-dark" : "bg-warning-light text-warning-dark"}>{DSR_STATUS_LABELS[x.status]}</Pill></td>
                <td className={`${tdClass} text-right`}><DsrRowActions id={x.id} status={x.status} canForward={canForward} canResolve={canResolve} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="GDPR žádosti"
        subtitle={`Správcem údajů zaměstnance je jeho firma, Dodio žádost eviduje a předá. Upozornění ${DSR_WARNING_DAYS} dní před lhůtou.`}
        actions={<NewDsrDialog companies={(companies ?? []).map((c) => ({ id: c.id, name: c.name, seq: c.seq_id }))} types={Object.entries(DSR_TYPE_LABELS).map(([key, label]) => ({ key, label }))} />}
      />
      <div className="space-y-6">
        <Card title={`Otevřené (${open.length})`}>{open.length === 0 ? <Empty>Žádné otevřené žádosti.</Empty> : table(open)}</Card>
        {done.length > 0 && <Card title={`Vyřízené (${done.length})`}>{table(done)}</Card>}
      </div>
    </>
  );
}
