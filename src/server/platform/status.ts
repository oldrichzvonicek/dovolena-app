import { companyLabel } from "./companies";
import { platformDb, writeAudit, type PlatformContext } from "./auth";

/**
 * Stavový automat firmy. Každý přechod provádí jen tahle funkce, která zároveň zapíše audit, takže stav nejde změnit „kolem“.
 * „Po splatnosti“ se neukládá, počítá se z faktur.
 */
export type CompanyStatus = "active" | "suspended" | "pending_deletion" | "deleted";

export const TRANSITIONS: Record<CompanyStatus, readonly CompanyStatus[]> = {
  active: ["suspended", "pending_deletion"],
  suspended: ["active", "pending_deletion"],
  pending_deletion: ["active", "suspended", "deleted"],
  deleted: [],
};

export const canTransition = (from: CompanyStatus, to: CompanyStatus): boolean => TRANSITIONS[from]?.includes(to) ?? false;

export const isCompanyStatus = (v: unknown): v is CompanyStatus => v === "active" || v === "suspended" || v === "pending_deletion" || v === "deleted";

export type TransitionResult = { ok: true; from: CompanyStatus } | { ok: false; code: "not_found" | "bad_transition" | "conflict" | "error"; message: string };

/**
 * Přepne stav firmy. Zápis je podmíněný původním stavem (dva admini naráz nepřepíšou jeden druhého). `extra` jsou další
 * sloupce zapsané ve stejném update (např. deletion_scheduled_at). `actor` = null je systém (cron, upomínky).
 */
export async function setCompanyStatus(
  actor: PlatformContext | null,
  companyId: string,
  to: CompanyStatus,
  opts: { action: string; details?: Record<string, unknown>; extra?: Record<string, unknown>; allowFrom?: readonly CompanyStatus[] } = { action: "company.status" }
): Promise<TransitionResult> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, name, seq_id, status").eq("id", companyId).maybeSingle();
  if (!company) return { ok: false, code: "not_found", message: "Firma nebyla nalezena." };
  const from = (company.status ?? "active") as CompanyStatus;
  if (!canTransition(from, to) || (opts.allowFrom && !opts.allowFrom.includes(from))) {
    return { ok: false, code: "bad_transition", message: `Ze stavu „${from}“ nelze přejít na „${to}“.` };
  }
  const { data: updated, error } = await db
    .from("companies")
    .update({ status: to, ...(opts.extra ?? {}) })
    .eq("id", companyId)
    .eq("status", from)
    .select("id");
  if (error) {
    await writeAudit(actor, { action: opts.action, result: "error", companyId, companyLabel: companyLabel(company), details: { error: error.message } });
    return { ok: false, code: "error", message: "Změnu se nepodařilo uložit." };
  }
  if ((updated?.length ?? 0) !== 1) return { ok: false, code: "conflict", message: "Stav firmy mezitím změnil někdo jiný. Načtěte stránku znovu." };
  await writeAudit(actor, { action: opts.action, companyId, companyLabel: companyLabel(company), details: { status: { from, to }, ...(opts.details ?? {}) } });
  return { ok: true, from };
}
