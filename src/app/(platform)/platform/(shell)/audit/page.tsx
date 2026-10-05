import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Empty, PageHeader, Pill, inputClass, labelClass, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDateTime } from "@/components/platform/format";
import { resolveContext } from "@/server/platform/auth";
import { actionLabel, loadAudit, type AuditFilters } from "@/server/platform/audit-query";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const PAGE = 50;
type SP = Promise<AuditFilters & { page?: string }>;

const RESULT: Record<string, string> = { ok: "bg-teal-light text-teal-dark", denied: "bg-warning-light text-warning-dark", error: "bg-danger-light text-danger-dark" };
const RESULT_LABEL: Record<string, string> = { ok: "OK", denied: "Zamítnuto", error: "Chyba" };

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "audit.read")) redirect("/login");
  const sp = await searchParams;
  const filters: AuditFilters = { q: sp.q, action: sp.action, company: sp.company, result: sp.result, from: sp.from, to: sp.to };
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await loadAudit(filters, PAGE, (page - 1) * PAGE);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle={`${total} záznamů. Záznamy se jen přidávají, nejdou upravit ani smazat.`}
        actions={
          <a href={`/api/platform/audit-log${qs({ page: undefined })}`} className="inline-flex items-center gap-2 rounded border border-line bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-paper dark:bg-surface">
            <Download size={15} /> Export CSV
          </a>
        }
      />

      <form className="mb-4 grid gap-3 rounded border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="lg:col-span-2">
          <label className={labelClass} htmlFor="a-q">Kdo nebo která firma</label>
          <input id="a-q" name="q" defaultValue={filters.q} className={inputClass} placeholder="e-mail admina, název firmy" />
        </div>
        <div>
          <label className={labelClass} htmlFor="a-action">Akce začíná na</label>
          <input id="a-action" name="action" defaultValue={filters.action} className={inputClass} placeholder="např. plan." />
        </div>
        <div>
          <label className={labelClass} htmlFor="a-result">Výsledek</label>
          <select id="a-result" name="result" defaultValue={filters.result ?? ""} className={inputClass}>
            <option value="">Všechny</option>
            <option value="ok">OK</option>
            <option value="denied">Zamítnuto</option>
            <option value="error">Chyba</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="a-from">Od</label>
          <input id="a-from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="a-to">Do</label>
          <input id="a-to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" variant="secondary">Filtrovat</Button>
          <Link href="/audit" className="text-sm text-teal-dark hover:underline">Zrušit filtry</Link>
        </div>
      </form>

      <Card>
        {rows.length === 0 ? (
          <Empty>Žádné záznamy neodpovídají filtru.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Čas</th>
                  <th className={thClass}>Kdo</th>
                  <th className={thClass}>Akce</th>
                  <th className={thClass}>Firma</th>
                  <th className={thClass}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(row.created_at)}</td>
                    <td className={tdClass}>{row.actor_label ?? (row.actor_type === "system" ? "systém" : "–")}{row.ip && <div className="text-caption text-muted">{row.ip}</div>}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{actionLabel(row.action)}</span>
                        {row.result !== "ok" && <Pill className={RESULT[row.result]}>{RESULT_LABEL[row.result]}</Pill>}
                      </div>
                    </td>
                    <td className={tdClass}>{row.company_id ? <Link href={`/companies/${row.company_id}`} className="text-teal-dark hover:underline">{row.company_label ?? "firma"}</Link> : "–"}</td>
                    <td className={`${tdClass} max-w-xs`}>
                      {Object.keys(row.details ?? {}).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-caption text-muted hover:text-ink">zobrazit</summary>
                          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-paper p-2 text-[11px]">{JSON.stringify(row.details, null, 2)}</pre>
                        </details>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Stránkování">
          <span className="text-muted">Strana {Math.min(page, pages)} z {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/audit${qs({ page: String(page - 1) })}`} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Novější</Link>}
            {page < pages && <Link href={`/audit${qs({ page: String(page + 1) })}`} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Starší</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
