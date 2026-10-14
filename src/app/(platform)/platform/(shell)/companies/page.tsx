import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Pill, Empty, tableClass, thClass, tdClass, inputClass } from "@/components/platform/ui";
import { COMPANY_STATUS, formatDate, formatKc, formatRelative, planName } from "@/components/platform/format";
import { ImpersonateButton } from "@/components/platform/ImpersonateButton";
import { SubscriptionDialog } from "@/components/platform/CompanyActions";
import { RowActionsMenu } from "@/components/platform/RowActionsMenu";
import { userLimitOf } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { resolveContext } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { ATTENTION_LABELS, FILTER_LABELS, applyFilter, applySearch, applySort, loadOverview, withDisplayActivity, type CompanyFilter, type CompanySort } from "@/server/platform/companies";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const FILTERS = Object.keys(FILTER_LABELS) as CompanyFilter[];
const SORTS: CompanySort[] = ["name", "users", "mrr", "created", "paid_until"];

type SP = Promise<{ filter?: string; q?: string; sort?: string; dir?: string; page?: string }>;

export default async function CompaniesPage({ searchParams }: { searchParams: SP }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "company.read_billing")) redirect("/login");
  const sp = await searchParams;
  const filter: CompanyFilter = FILTERS.includes(sp.filter as CompanyFilter) ? (sp.filter as CompanyFilter) : "all";
  const sort: CompanySort = SORTS.includes(sp.sort as CompanySort) ? (sp.sort as CompanySort) : "name";
  const desc = sp.dir === "desc";
  const q = (sp.q ?? "").slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const today = todayIso();

  // Aktivita se dopočítá čerstvě jen pro zobrazení (bez zápisu — GET stránka nesmí dělat zápisy do databáze).
  // Uložená last_activity_at se průběžně aktualizuje na pozadí, viz úloha activity.refresh.
  const all = await withDisplayActivity(await loadOverview());
  const canImpersonate = can(r.ctx.role, "company.impersonate");
  const canChangePlan = can(r.ctx.role, "plan.change");
  const showActions = canImpersonate || canChangePlan;
  // Aktivita je dopočítaná pro všechny firmy, takže jde spočítat i filtr Neaktivní (dřív jako jediný počet neměl).
  const counts = Object.fromEntries(FILTERS.map((f) => [f, applyFilter(all, f, today).length])) as Record<CompanyFilter, number>;
  const rows = applySort(applySearch(applyFilter(all, filter, today), q), sort, desc);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { filter: filter === "all" ? undefined : filter, q: q || undefined, sort: sort === "name" ? undefined : sort, dir: desc ? "desc" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/companies${s ? `?${s}` : ""}`;
  };
  const sortLink = (key: CompanySort, label: string, right?: boolean) => (
    <Link href={href({ sort: key === "name" ? undefined : key, dir: sort === key && !desc ? "desc" : undefined, page: undefined })} className={cn("hover:text-ink", right && "block text-right")}>
      {label}
      {sort === key && <span aria-hidden> {desc ? "↓" : "↑"}</span>}
    </Link>
  );

  type Row = (typeof shown)[number];
  const rowInfo = (c: Row) => ({
    limit: userLimitOf(c.plan),
    st: COMPANY_STATUS[c.status] ?? COMPANY_STATUS.active,
    inactive: c.attention.length === 0 && (!c.last_activity_at || Date.now() - new Date(c.last_activity_at).getTime() > 30 * 86_400_000),
  });
  const attentionPills = (c: Row) =>
    c.attention
      .filter((a) => a !== "pending_plan")
      .map((a) => (
        <Pill key={a} className={a === "overdue" || a === "expired" || a === "over_limit" ? "bg-danger-light text-danger-dark" : "bg-warning-light text-warning-dark"}>{ATTENTION_LABELS[a]}</Pill>
      ));
  const rowActions = (c: Row) => {
    const active = c.status !== "pending_deletion" && c.status !== "deleted";
    if (!active || !(canImpersonate || canChangePlan)) return null;
    return (
      <div className="flex justify-end">
        <RowActionsMenu label={`Akce k firmě ${c.name}`}>
          {canImpersonate && <ImpersonateButton companyId={c.id} variant="menuItem" />}
          {canChangePlan && (
            <SubscriptionDialog
              variant="menuItem"
              company={{ id: c.id, plan: c.plan, addons: c.addons ?? [], billing_period: c.billing_period, plan_paid_until: c.plan_paid_until, discount_pct: c.discount_pct, pending_plan: c.pending_plan, pending_plan_from: c.pending_plan_from, users: c.users }}
            />
          )}
        </RowActionsMenu>
      </div>
    );
  };

  return (
    <>
      <PageHeader title="Firmy" subtitle={`${rows.length} z ${all.length} firem (z toho ${counts.test} testovacích, v Přehledu se nepočítají)`} />

      <form action="/companies" className="mb-3 flex items-center gap-2" role="search">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <div className="relative min-w-0 flex-1 sm:max-w-xs sm:flex-none sm:basis-80">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Název nebo číslo firmy (#12)" aria-label="Hledat firmu" className={`${inputClass} pl-9`} />
        </div>
        <Button type="submit" variant="secondary">Hledat</Button>
        {q && <Link href={href({ q: undefined })} className="whitespace-nowrap text-sm text-teal-dark hover:underline">Zrušit</Link>}
      </form>

      {/* Na mobilu jeden vodorovně posuvný řádek, ať filtry nezabírají půl obrazovky. */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {FILTERS.map((f) => (
          <Link key={f} href={href({ filter: f === "all" ? undefined : f, page: undefined })} aria-current={f === filter ? "true" : undefined} className={cn("shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition-colors", f === filter ? f === "test" ? "border-ink border-dashed bg-transparent text-ink" : "border-teal-dark bg-teal-light text-teal-dark" : "border-line bg-surface text-ink hover:bg-paper")}>
            {FILTER_LABELS[f]}
            <span className="ml-1.5 text-caption text-muted tabular-nums">{counts[f]}</span>
          </Link>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-3 text-sm text-muted md:hidden">
        <span>Řadit:</span>
        {sortLink("name", "Název")}
        {sortLink("users", "Uživatelé")}
        {sortLink("paid_until", "Platí do")}
        {sortLink("mrr", "MRR")}
      </div>

      {shown.length === 0 ? (
        <Empty>Žádná firma neodpovídá výběru.</Empty>
      ) : (
        <>
          {/* Mobil: kartičky (celá karta je odkaz na detail, menu akcí leží nad ní). */}
          <ul className="space-y-2 md:hidden">
            {shown.map((c) => {
              const { limit, st, inactive } = rowInfo(c);
              const actions = rowActions(c);
              const pills = attentionPills(c);
              return (
                <li key={c.id} className="relative rounded border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/companies/${c.id}`} className="font-medium text-teal-dark after:absolute after:inset-0">{c.name}</Link>
                      {c.is_test && <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-muted">test</span>}
                      <div className="text-caption text-muted">
                        #{c.seq_id} · {planName(c.plan)}
                        {c.pending_plan && ` → ${planName(c.pending_plan)} od ${formatDate(c.pending_plan_from)}`}
                      </div>
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-1">
                      <Pill className={st.className}>{st.label}</Pill>
                      {actions}
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Uživatelé</dt>
                      <dd className={`tabular-nums ${limit !== null && c.users > limit ? "font-semibold text-danger-dark" : ""}`}>
                        {c.users}
                        {limit !== null && <span className="text-muted"> / {limit}</span>}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">MRR</dt>
                      <dd className="tabular-nums">{c.mrr > 0 ? formatKc(c.mrr) : "–"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Aktivita</dt>
                      <dd className={inactive ? "font-medium text-warning-dark" : ""}>{formatRelative(c.last_activity_at)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Platí do</dt>
                      <dd className={c.attention.includes("expired") ? "text-danger-dark" : ""}>{c.plan_paid_until ? formatDate(c.plan_paid_until) : "–"}</dd>
                    </div>
                  </dl>
                  {pills.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{pills}</div>}
                </li>
              );
            })}
          </ul>

          {/* Od tabletu: tabulka. */}
          <div className="hidden overflow-x-auto rounded border border-line bg-surface md:block">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Č.</th>
                  <th className={thClass}>{sortLink("name", "Firma")}</th>
                  <th className={thClass}>Tarif</th>
                  <th className={thClass}>Stav</th>
                  <th className={`${thClass} text-right`}>{sortLink("users", "Uživatelé", true)}</th>
                  <th className={thClass} title="Poslední přihlášení člena firmy nebo práce se žádostmi o absenci (za 90 dní)">Aktivita</th>
                  <th className={thClass}>{sortLink("paid_until", "Platí do")}</th>
                  <th className={`${thClass} text-right`}>{sortLink("mrr", "MRR", true)}</th>
                  <th className={thClass}>Upozornění</th>
                  {showActions && <th className={thClass}><span className="sr-only">Akce</span></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => {
                  const { limit, st, inactive } = rowInfo(c);
                  return (
                    <tr key={c.id} className="hover:bg-paper/60">
                      <td className={`${tdClass} text-muted tabular-nums`}>{c.seq_id}</td>
                      <td className={tdClass}>
                        <Link href={`/companies/${c.id}`} className="font-medium text-teal-dark hover:underline">{c.name}</Link>
                        {c.is_test && <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-muted">test</span>}
                      </td>
                      <td className={tdClass}>
                        {planName(c.plan)}
                        {c.pending_plan && <div className="text-caption text-muted">→ {planName(c.pending_plan)} od {formatDate(c.pending_plan_from)}</div>}
                      </td>
                      <td className={tdClass}><Pill className={st.className}>{st.label}</Pill></td>
                      <td className={`${tdClass} text-right tabular-nums ${limit !== null && c.users > limit ? "font-semibold text-danger-dark" : ""}`}>
                        {c.users}
                        {limit !== null && <span className="text-muted"> / {limit}</span>}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap ${inactive ? "font-medium text-warning-dark" : "text-muted"}`} title={c.last_activity_at ? formatDate(c.last_activity_at) : undefined}>{formatRelative(c.last_activity_at)}</td>
                      <td className={`${tdClass} whitespace-nowrap ${c.attention.includes("expired") ? "text-danger-dark" : ""}`}>{c.plan_paid_until ? formatDate(c.plan_paid_until) : "–"}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{c.mrr > 0 ? formatKc(c.mrr) : "–"}</td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1">{attentionPills(c)}</div>
                      </td>
                      {showActions && <td className={tdClass}>{rowActions(c)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Stránkování">
          <span className="text-muted">Strana {Math.min(page, pages)} z {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Předchozí</Link>}
            {page < pages && <Link href={href({ page: String(page + 1) })} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Další</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
