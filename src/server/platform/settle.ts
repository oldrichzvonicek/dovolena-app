import { templateText } from "@/lib/email-templates";
import { platformDb, writeAudit, type PlatformContext } from "./auth";
import { todayIso } from "./billing";
import { companyLabel } from "./companies";
import { SIGNATURE, queueCompanyEmail } from "./email";

export interface SettleInput {
  invoiceId: string;
  receivedAt: string;
  /** Nová platnost tarifu; bez ní se použije konec období z faktury (period_to), pokud existuje. */
  extendUntil?: string | null;
  source: "manual" | "gateway";
  providerRef?: string | null;
  /** null = systém (webhook, cron). */
  actor: PlatformContext | null;
}

export type SettleResult = { ok: true; restored: boolean } | { ok: false; code: "not_found" | "bad_state" | "insert_failed"; message: string };

/**
 * Zaplacení faktury: uzavře fakturu, zapíše platbu, prodlouží platnost tarifu, vrátí pozastavenou firmu do provozu
 * (když nemá další faktury po splatnosti) a pošle e-maily. Společné pro ruční „Označit jako zaplaceno“ i webhook Fakturoidu.
 */
export async function settleInvoicePaid(opts: SettleInput): Promise<SettleResult> {
  const db = platformDb();
  const { data: invoice } = await db.from("company_invoices").select("id, company_id, number, amount, status, period_to").eq("id", opts.invoiceId).maybeSingle();
  if (!invoice) return { ok: false, code: "not_found", message: "Faktura nebyla nalezena." };
  if (invoice.status !== "issued") {
    return { ok: false, code: "bad_state", message: invoice.status === "paid" ? "Faktura je už zaplacená." : "Fakturu ve stavu storno nelze zaplatit." };
  }
  const { data: company } = await db.from("companies").select("id, seq_id, name, status, plan_paid_until").eq("id", invoice.company_id).maybeSingle();
  if (!company) return { ok: false, code: "not_found", message: "Firma nebyla nalezena." };

  // Uzavření faktury jen z právě „vystavené“ (ochrana proti dvojímu kliknutí / dvojímu webhooku).
  const { data: closed } = await db.from("company_invoices").update({ status: "paid", paid_at: opts.receivedAt }).eq("id", opts.invoiceId).eq("status", "issued").select("id");
  if ((closed?.length ?? 0) !== 1) return { ok: false, code: "bad_state", message: "Faktura je už zaplacená." };
  const { error: payErr } = await db.from("payments").insert({
    invoice_id: opts.invoiceId,
    company_id: invoice.company_id,
    source: opts.source,
    provider_ref: opts.providerRef ?? null,
    amount: invoice.amount,
    received_at: opts.receivedAt,
    created_by: opts.actor?.userId ?? null,
  });
  if (payErr) {
    await db.from("company_invoices").update({ status: "issued", paid_at: null }).eq("id", opts.invoiceId);
    await writeAudit(opts.actor, { action: "invoice.paid", result: "error", companyId: company.id, companyLabel: companyLabel(company), details: { number: invoice.number, error: payErr.message } });
    return { ok: false, code: "insert_failed", message: "Platbu se nepodařilo zapsat." };
  }

  const details: Record<string, unknown> = { number: invoice.number, amount: Number(invoice.amount), received_at: opts.receivedAt, source: opts.source };
  const target = opts.extendUntil ?? invoice.period_to ?? null;
  if (target && target !== company.plan_paid_until && (!company.plan_paid_until || target > company.plan_paid_until || opts.extendUntil)) {
    await db.from("companies").update({ plan_paid_until: target }).eq("id", company.id);
    details.plan_paid_until = { from: company.plan_paid_until, to: target };
  }
  let restored = false;
  if (company.status === "suspended") {
    const { data: stillOverdue } = await db.from("company_invoices").select("id").eq("company_id", company.id).eq("status", "issued").lt("due_at", todayIso()).limit(1);
    if ((stillOverdue?.length ?? 0) === 0) {
      await db.from("companies").update({ status: "active" }).eq("id", company.id);
      details.status = { from: "suspended", to: "active" };
      restored = true;
    }
  }
  await writeAudit(opts.actor, { action: "invoice.paid", companyId: company.id, companyLabel: companyLabel(company), details });
  const paid = templateText("payment_received", { cislo: invoice.number, castka: `${Math.round(Number(invoice.amount)).toLocaleString("cs-CZ")} Kč` });
  await queueCompanyEmail(company.id, paid.subject, `${paid.body}${SIGNATURE}`);
  if (restored) {
    const back = templateText("account_restored", {});
    await queueCompanyEmail(company.id, back.subject, `${back.body}${SIGNATURE}`);
  }
  return { ok: true, restored };
}
