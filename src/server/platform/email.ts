import { platformDb } from "./auth";

/**
 * E-maily provozovatele firmám. Vždy přes email_outbox (odešle je /api/cron/process), kategorie `billing` = provozní,
 * nejde vypnout. Adresát je fakturační e-mail firmy (company_billing.billing_email) a aktivní admini firmy, bez duplicit.
 */
export async function companyRecipients(companyId: string): Promise<string[]> {
  const db = platformDb();
  const [{ data: billing }, { data: admins }] = await Promise.all([
    db.from("company_billing").select("billing_email").eq("company_id", companyId).maybeSingle(),
    db.from("profiles").select("email").eq("company_id", companyId).eq("role", "admin").eq("active", true).eq("is_demo", false),
  ]);
  const all = [billing?.billing_email, ...(admins ?? []).map((a) => a.email)].filter((e): e is string => !!e && /^\S+@\S+\.\S+$/.test(e));
  return Array.from(new Set(all.map((e) => e.trim().toLowerCase())));
}

export async function queueCompanyEmail(companyId: string, subject: string, body: string): Promise<number> {
  const to = await companyRecipients(companyId);
  if (to.length === 0) return 0;
  const { error } = await platformDb()
    .from("email_outbox")
    .insert(to.map((email) => ({ company_id: companyId, category: "billing", to_email: email, subject, body })));
  if (error) {
    console.error("platform e-mail:", error.message);
    return 0;
  }
  return to.length;
}

export const SIGNATURE = "\n\nS pozdravem\ntým Dodio";
export const czDate = (iso: string | Date) => new Date(iso).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" });
