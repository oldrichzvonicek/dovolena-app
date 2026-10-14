import { planByKey } from "@/lib/plans";
import { templateText } from "@/lib/email-templates";
import { appUrl } from "@/lib/email";
import { platformDb, writeAudit } from "./auth";
import { extendPaidUntil, formatCzDate, periodAmount } from "./billing";
import { loadBillingBasis } from "./companies";
import { BANK_ACCOUNT, SIGNATURE, invoicePdfLink, pdfTrailer, queueCompanyEmail, variableSymbol } from "./email";
import { createInvoice, downloadPdf, ensureSubject, ensureWebhook, fakturoidConfig, findInvoiceByCustomId, isVatPayer } from "./fakturoid";
import { addDaysIso } from "@/lib/plan-change";

export interface AutoBillingSummary {
  configured: boolean;
  issued: number;
  skipped: number;
  failed: number;
  webhookRegistered: boolean;
}

const WINDOW_DAYS = 7; // fakturuje se týden před koncem zaplaceného období
const MAX_PER_RUN = 25; // pojistka: jeden běh nevystaví víc než tolik faktur

/**
 * Automatické fakturování přes Fakturoid: placeným firmám vystaví fakturu na další období, týden před koncem platnosti
 * (nebo hned, když platnost není nastavená), stáhne PDF, uloží ho a pošle zákazníkovi e-mail. Zaplacení pak přijde webhookem.
 * Bez FAKTUROID_* proměnných nedělá nic.
 */
export async function runAutoBilling(): Promise<AutoBillingSummary> {
  const summary: AutoBillingSummary = { configured: false, issued: 0, skipped: 0, failed: 0, webhookRegistered: false };
  const cfg = fakturoidConfig();
  if (!cfg) return summary;
  summary.configured = true;
  const db = platformDb();

  try {
    summary.webhookRegistered = await ensureWebhook(cfg, `${appUrl()}/api/webhooks/fakturoid`);
  } catch (e) {
    console.error("fakturoid webhook:", e instanceof Error ? e.message : e);
  }

  const { today, companies, users, priceFor } = await loadBillingBasis();
  const horizon = addDaysIso(today, WINDOW_DAYS);
  let vatPayer: boolean | null = null;

  for (const c of companies) {
    if (summary.issued >= MAX_PER_RUN) break;
    if (c.is_test || (c.status ?? "active") !== "active") continue;
    const override = priceFor(c);
    const paidPlan = (override?.monthly ?? planByKey(c.plan).monthly) > 0;
    if (!paidPlan) continue;
    if (c.plan_paid_until && c.plan_paid_until > horizon) continue; // ještě zaplaceno dost dlouho dopředu

    const periodFrom = c.plan_paid_until && c.plan_paid_until >= today ? addDaysIso(c.plan_paid_until, 1) : today;
    const period = c.billing_period === "yearly" ? "yearly" : "monthly";
    const periodTo = extendPaidUntil(c.plan_paid_until, today, period);

    // Už vystavená nezaplacená faktura (jakákoli) nebo faktura za stejné období = nic nového.
    const { data: open } = await db.from("company_invoices").select("id, period_from, status").eq("company_id", c.id).in("status", ["issued", "paid"]);
    if ((open ?? []).some((i) => i.status === "issued" || i.period_from === periodFrom)) {
      summary.skipped++;
      continue;
    }

    const { data: billing } = await db.from("company_billing").select("billing_name, billing_ico, billing_dic, billing_street, billing_city, billing_zip, billing_email, payment_method").eq("company_id", c.id).maybeSingle();
    if (!billing?.billing_name || (billing.payment_method ?? "invoice") !== "invoice") {
      summary.skipped++; // chybí fakturační údaje (nebo platí jinak): nic se nevystavuje, ať se nevyrábí neúplná faktura
      continue;
    }

    const amount = periodAmount({
      plan: c.plan,
      addons: c.addons,
      billingPeriod: period,
      users: users.get(c.id) ?? 0,
      discountPct: Number(c.discount_pct ?? 0),
      priceOverride: override,
    });
    if (amount <= 0) {
      summary.skipped++;
      continue;
    }

    try {
      vatPayer ??= await isVatPayer(cfg);
      const customId = `${c.id}:${periodFrom}`;
      let inv = await findInvoiceByCustomId(cfg, customId);
      if (!inv) {
        const subjectId = await ensureSubject(cfg, {
          customId: c.id,
          name: billing.billing_name,
          ico: billing.billing_ico,
          dic: billing.billing_dic,
          street: billing.billing_street,
          city: billing.billing_city,
          zip: billing.billing_zip,
          email: billing.billing_email,
        });
        inv = await createInvoice(cfg, {
          subjectId,
          customId,
          name: `Dodio — tarif ${planByKey(c.plan).name}, ${formatCzDate(periodFrom)} – ${formatCzDate(periodTo)}`,
          amount,
          vatPayer,
        });
      }

      const pdf = await downloadPdf(cfg, inv.id);
      const path = `${c.id}/${inv.number.replace(/[^\w.-]/g, "_")}.pdf`;
      const { error: upErr } = await db.storage.from("company-invoices").upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(`uložení PDF: ${upErr.message}`);

      const { error: insErr } = await db.from("company_invoices").insert({
        company_id: c.id,
        number: inv.number,
        issue_date: inv.issuedOn || today,
        due_at: inv.dueOn || addDaysIso(today, 14),
        amount: inv.total || amount,
        vat: inv.vat,
        currency: "CZK",
        status: "issued",
        buyer_snapshot: { name: billing.billing_name, ico: billing.billing_ico, dic: billing.billing_dic, street: billing.billing_street, city: billing.billing_city, zip: billing.billing_zip },
        file_url: path,
        fakturoid_id: inv.id,
        variable_symbol: inv.variableSymbol || variableSymbol(inv.number),
        period_from: periodFrom,
        period_to: periodTo,
        source: "fakturoid",
      });
      if (insErr) throw new Error(`zápis faktury: ${insErr.message}`);

      const mail = templateText("invoice_issued", {
        cislo: inv.number,
        castka: `${Math.round(inv.total || amount).toLocaleString("cs-CZ")} Kč`,
        splatnost: formatCzDate(inv.dueOn),
        ucet: BANK_ACCOUNT,
        vs: inv.variableSymbol || variableSymbol(inv.number),
        pdf: "ano",
      });
      await queueCompanyEmail(c.id, mail.subject, `${mail.body}${SIGNATURE}${pdfTrailer(await invoicePdfLink(path))}`);
      await writeAudit(null, { action: "invoice.create", companyId: c.id, companyLabel: c.name, details: { number: inv.number, amount: inv.total || amount, source: "fakturoid", period_from: periodFrom, period_to: periodTo } });
      summary.issued++;
    } catch (e) {
      summary.failed++;
      console.error(`autobilling ${c.id}:`, e instanceof Error ? e.message : e);
      await writeAudit(null, { action: "invoice.create", result: "error", companyId: c.id, companyLabel: c.name, details: { source: "fakturoid", error: e instanceof Error ? e.message : String(e) } });
    }
  }
  return summary;
}
