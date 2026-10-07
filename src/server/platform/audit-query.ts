import { platformDb } from "./auth";

export interface AuditRow {
  id: string;
  created_at: string;
  actor_type: string;
  actor_label: string | null;
  action: string;
  result: "ok" | "denied" | "error";
  company_id: string | null;
  company_label: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  via_impersonation: boolean;
}

export interface AuditFilters {
  q?: string;
  action?: string;
  company?: string;
  result?: string;
  from?: string;
  to?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
export const AUDIT_COLUMNS = "id, created_at, actor_type, actor_label, action, result, company_id, company_label, details, ip, via_impersonation";

/** Odstraní znaky, které mají v PostgREST filtru zvláštní význam (čárka, závorky, procenta), ať se hledaný text nedá zneužít. */
const cleanSearch = (s: string) => s.replace(/[^\p{L}\p{N} @._#-]/gu, "").trim().slice(0, 80);

export async function loadAudit(f: AuditFilters, limit = 100, offset = 0): Promise<{ rows: AuditRow[]; total: number }> {
  let q = platformDb().from("platform_audit_log").select(AUDIT_COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).order("id", { ascending: false });
  const search = f.q ? cleanSearch(f.q) : "";
  if (search) q = q.or(`actor_label.ilike.%${search}%,company_label.ilike.%${search}%`);
  const action = f.action ? cleanSearch(f.action) : "";
  if (action) q = q.ilike("action", `${action}%`);
  if (f.company && UUID.test(f.company)) q = q.eq("company_id", f.company);
  if (f.result === "ok" || f.result === "denied" || f.result === "error") q = q.eq("result", f.result);
  if (f.from && ISO.test(f.from)) q = q.gte("created_at", `${f.from}T00:00:00+02:00`);
  if (f.to && ISO.test(f.to)) q = q.lt("created_at", new Date(new Date(`${f.to}T00:00:00+02:00`).getTime() + 86_400_000).toISOString());
  const { data, count, error } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

/** Lidský popis nejčastějších akcí. Neznámé akce se ukážou tak, jak jsou. */
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Přihlášení",
  "auth.logout": "Odhlášení",
  "auth.login_failed": "Neúspěšné přihlášení",
  "auth.login_denied": "Přihlášení zamítnuto (není admin)",
  "auth.totp_failed": "Chybný kód TOTP",
  "auth.locked": "Zámek přihlášení",
  "auth.stepup": "Ověření citlivé akce",
  "auth.stepup_failed": "Chybné ověření citlivé akce",
  "plan.change": "Změna tarifu",
  "pricing.change": "Změna ceníku",
  "invoice.create": "Vystavení faktury",
  "invoice.paid": "Faktura zaplacena",
  "invoice.void": "Storno faktury",
  "invoice.remind": "Ruční upomínka k faktuře",
  "note.create": "Poznámka k firmě",
  "team.update": "Změna admina",
  "audit.export": "Export audit logu",
  "company.view": "Zobrazení firmy",
  "company.status": "Změna stavu firmy",
  "company.suspend": "Pozastavení firmy",
  "company.unsuspend": "Obnovení provozu firmy",
  "company.delete": "Naplánování smazání firmy",
  "company.restore": "Obnovení firmy před smazáním",
  "company.deleted": "Firma definitivně smazána",
  "company.export": "Export dat firmy",
  "impersonation.start": "Zahájení náhledu firmy",
  "impersonation.view": "Zobrazení náhledu firmy",
  "impersonation.end": "Ukončení náhledu firmy",
  "dsr.create": "GDPR žádost založena",
  "dsr.forward": "GDPR žádost předána firmě",
  "dsr.resolve": "GDPR žádost vyřízena",
  "legal.create": "Nová verze právního dokumentu",
  "jobs.run": "Ruční spuštění úloh",
  "job.failed": "Úloha selhala",
  "dunning.reminder_1": "Upomínka po splatnosti (1.)",
  "dunning.reminder_2": "Upomínka po splatnosti (2.)",
  "dunning.reminder_3": "Poslední upomínka po splatnosti",
  "dunning.suspend": "Pozastavení firmy kvůli nezaplacené faktuře",
  "denied:step_up": "Zamítnuto: chybí ověření kódem TOTP",
};

/** Oprávnění, která se v auditu objevují jako „denied:<oprávnění>“, česky. */
const PERMISSION_LABELS: Record<string, string> = {
  "company.suspend": "pozastavení firmy",
  "company.delete": "smazání firmy",
  "company.impersonate": "náhled firmy",
  "company.export": "export dat firmy",
  "plan.change": "změna tarifu",
  "billing.write": "úprava faktur",
  "gdpr.handle": "vyřízení GDPR žádosti",
  "settings.write": "nastavení",
  "pricing.write": "změna ceníku",
  "team.manage": "správa týmu",
  "notes.write": "poznámky",
};

export const actionLabel = (a: string) => {
  if (ACTION_LABELS[a]) return ACTION_LABELS[a];
  if (a.startsWith("denied:")) return `Zamítnuto (chybí oprávnění): ${PERMISSION_LABELS[a.slice(7)] ?? a.slice(7)}`;
  return a;
};
