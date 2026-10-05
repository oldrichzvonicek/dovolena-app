import { fetchAll } from "@/lib/fetch-all";
import { planByKey } from "@/lib/plans";
import type { InvoiceItem } from "@/components/platform/InvoiceActions";
import { extendPaidUntil, isOverdue, todayIso } from "./billing";
import { INVOICE_COLUMNS, type InvoiceRow } from "./companies";
import { platformDb } from "./auth";

export interface CompanyMini {
  id: string;
  name: string;
  seq_id: number;
  plan: string;
  billing_period: string;
  plan_paid_until: string | null;
}

export function toInvoiceItems(invoices: InvoiceRow[], companies: Map<string, CompanyMini>): InvoiceItem[] {
  const today = todayIso();
  return invoices.map((i) => {
    const c = companies.get(i.company_id);
    const paidPlan = c ? planByKey(c.plan).monthly > 0 : false;
    return {
      id: i.id,
      number: i.number,
      company_id: i.company_id,
      companyName: c?.name,
      companySeq: c?.seq_id,
      issue_date: i.issue_date,
      due_at: i.due_at,
      paid_at: i.paid_at,
      amount: Number(i.amount),
      vat: Number(i.vat ?? 0),
      status: i.status,
      hasFile: !!i.file_url,
      overdue: isOverdue(i, today),
      suggestExtend: c && paidPlan && i.status === "issued" ? extendPaidUntil(c.plan_paid_until, today, c.billing_period === "yearly" ? "yearly" : "monthly") : null,
    };
  });
}

export const INVOICES_PAGE_SIZE = 50;

export interface InvoicesPage {
  items: InvoiceItem[];
  companies: CompanyMini[];
  total: number;
  /** Součty za CELÝ filtrovaný výběr (ne jen za zobrazenou stránku). */
  openTotal: number;
  overdueTotal: number;
}

export async function loadInvoices(status: string | null, page = 1): Promise<InvoicesPage> {
  const db = platformDb();
  const offset = Math.max(0, page - 1) * INVOICES_PAGE_SIZE;
  const isOverdueFilter = status === "overdue";

  let listQuery = db.from("company_invoices").select(INVOICE_COLUMNS, { count: "exact" }).order("issue_date", { ascending: false }).order("number", { ascending: false });
  if (isOverdueFilter) listQuery = listQuery.eq("status", "issued").lt("due_at", todayIso());
  else if (status === "issued" || status === "paid" || status === "void") listQuery = listQuery.eq("status", status);

  const [{ data: invoices, count }, { data: companies }] = await Promise.all([
    listQuery.range(offset, offset + INVOICES_PAGE_SIZE - 1),
    db.from("companies").select("id, name, seq_id, plan, billing_period, plan_paid_until").order("name"),
  ]);

  // Součty za celý (nestránkovaný) výběr — jen amount/status/due_at, ať dotaz zůstane levný i při tisících faktur.
  const { data: totals } = await fetchAll<{ amount: number; status: string; due_at: string | null }>((from, to) => {
    let q = db.from("company_invoices").select("amount, status, due_at").order("id").range(from, to);
    if (isOverdueFilter) q = q.eq("status", "issued").lt("due_at", todayIso());
    else if (status === "issued" || status === "paid" || status === "void") q = q.eq("status", status);
    return q;
  });
  const today = todayIso();
  const openTotal = totals.filter((i) => i.status === "issued").reduce((s, i) => s + Number(i.amount), 0);
  const overdueTotal = totals.filter((i) => isOverdue(i, today)).reduce((s, i) => s + Number(i.amount), 0);

  const list = (companies ?? []) as CompanyMini[];
  const map = new Map(list.map((c) => [c.id, c]));
  return { items: toInvoiceItems((invoices ?? []) as InvoiceRow[], map), companies: list, total: count ?? 0, openTotal, overdueTotal };
}
