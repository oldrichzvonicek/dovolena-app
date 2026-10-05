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
  "invoice.create": "Vystavení faktury",
  "invoice.paid": "Faktura zaplacena",
  "invoice.void": "Storno faktury",
  "note.create": "Poznámka k firmě",
  "team.update": "Změna admina",
  "audit.export": "Export audit logu",
  "company.view": "Zobrazení firmy",
};

export const actionLabel = (a: string) => (a.startsWith("denied:") ? `Zamítnuto: ${a.slice(7)}` : ACTION_LABELS[a] ?? a);
