import Link from "next/link";
import { redirect } from "next/navigation";
import { NewInvoiceDialog, InvoicesTable } from "@/components/platform/InvoiceActions";
import { Card, PageHeader } from "@/components/platform/ui";
import { formatKc } from "@/components/platform/format";
import { cn } from "@/lib/utils";
import { resolveContext } from "@/server/platform/auth";
import { INVOICES_PAGE_SIZE, loadInvoices } from "@/server/platform/invoices";
import { can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "", label: "Všechny" },
  { key: "issued", label: "Vystavené" },
  { key: "overdue", label: "Po splatnosti" },
  { key: "paid", label: "Zaplacené" },
  { key: "void", label: "Storno" },
];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "billing.read")) redirect("/login");
  const sp = await searchParams;
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, companies, total, openTotal, overdueTotal } = await loadInvoices(status || null, page);
  const canWrite = can(r.ctx.role, "billing.write");
  const pages = Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE));
  const pageLink = (p: number) => `/invoices?${status ? `status=${status}&` : ""}page=${p}`;

  return (
    <>
      <PageHeader
        title="Faktury"
        subtitle={`${total} faktur ve výběru · nezaplaceno ${formatKc(openTotal)}${overdueTotal > 0 ? `, z toho po splatnosti ${formatKc(overdueTotal)}` : ""}`}
        actions={canWrite ? <NewInvoiceDialog companies={companies.map((c) => ({ id: c.id, name: c.name, seq: c.seq_id }))} /> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key ? `/invoices?status=${t.key}` : "/invoices"} aria-current={t.key === status ? "true" : undefined} className={cn("rounded-full border px-3 py-1 text-sm transition-colors", t.key === status ? "border-teal-dark bg-teal-light text-teal-dark" : "border-line bg-surface text-ink hover:bg-paper")}>
            {t.label}
          </Link>
        ))}
      </div>
      <Card>
        <InvoicesTable invoices={items} canWrite={canWrite} showCompany />
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Stránkování">
          <span className="text-muted">Strana {Math.min(page, pages)} z {pages} ({total} faktur)</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageLink(page - 1)} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Předchozí</Link>}
            {page < pages && <Link href={pageLink(page + 1)} className="rounded border border-line bg-surface px-3 py-1.5 hover:bg-paper">Další</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
