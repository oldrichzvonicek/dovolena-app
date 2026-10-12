import { addDaysIso } from "@/lib/plan-change";
import { platformDb, writeAudit, type PlatformContext } from "./auth";
import { companyLabel } from "./companies";
import { SIGNATURE, czDate, queueCompanyEmail } from "./email";
import { todayIso } from "./billing";

/**
 * GDPR žádosti subjektů údajů. Správcem údajů zaměstnance je jeho firma, Dodio je zpracovatel: žádost se tady jen eviduje
 * (bez osobních údajů žadatele, jen popisek typu „zaměstnanec, oddělení Sklad“), předá firmě a hlídá se lhůta 30 dní.
 * Provedení (výmaz, oprava, export) dělá firma ve své aplikaci; žádost o vlastní účet firmy vede na proces smazání.
 */
export type DsrType = "access" | "erasure" | "rectification" | "portability" | "restriction" | "objection";
export type DsrStatus = "received" | "forwarded" | "resolved";

export const DSR_TYPE_LABELS: Record<DsrType, string> = {
  access: "Přístup k údajům",
  erasure: "Výmaz",
  rectification: "Oprava",
  portability: "Přenositelnost",
  restriction: "Omezení zpracování",
  objection: "Námitka",
};
export const DSR_STATUS_LABELS: Record<DsrStatus, string> = { received: "Přijatá", forwarded: "Předaná firmě", resolved: "Vyřízená" };
export const DSR_DEADLINE_DAYS = 30;
export const DSR_WARNING_DAYS = 7;

export const isDsrType = (v: unknown): v is DsrType => typeof v === "string" && v in DSR_TYPE_LABELS;

export interface DsrRow {
  id: string;
  company_id: string;
  type: DsrType;
  subject_label: string;
  received_at: string;
  due_at: string;
  status: DsrStatus;
  forwarded_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
}

export const dueDate = (receivedAt: string) => addDaysIso(receivedAt, DSR_DEADLINE_DAYS);

/** Zbývající dny do lhůty (záporné = po lhůtě). */
export function daysLeft(dueAt: string, today: string): number {
  return Math.round((new Date(`${dueAt}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
}

export const isDueSoon = (r: Pick<DsrRow, "status" | "due_at">, today: string) => r.status !== "resolved" && daysLeft(r.due_at, today) <= DSR_WARNING_DAYS;

export async function loadDsr(): Promise<(DsrRow & { company_name: string; company_seq: number })[]> {
  const db = platformDb();
  const { data } = await db.from("data_subject_requests").select("*").order("due_at");
  const rows = (data ?? []) as DsrRow[];
  const { data: companies } = await db.from("companies").select("id, name, seq_id").in("id", Array.from(new Set(rows.map((r) => r.company_id))));
  const byId = new Map((companies ?? []).map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, company_name: byId.get(r.company_id)?.name ?? "?", company_seq: byId.get(r.company_id)?.seq_id ?? 0 }));
}

export async function countDueSoon(): Promise<number> {
  const { data } = await platformDb().from("data_subject_requests").select("status, due_at").neq("status", "resolved");
  const today = todayIso();
  return ((data ?? []) as Pick<DsrRow, "status" | "due_at">[]).filter((r) => isDueSoon(r, today)).length;
}

export async function createDsr(ctx: PlatformContext, input: { company_id: string; type: DsrType; subject_label: string; received_at: string }): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, name, seq_id").eq("id", input.company_id).maybeSingle();
  if (!company) return { ok: false, message: "Firma nebyla nalezena." };
  const { data, error } = await db.from("data_subject_requests").insert({ ...input, due_at: dueDate(input.received_at), created_by: ctx.userId }).select("id").single();
  if (error || !data) return { ok: false, message: "Žádost se nepodařilo uložit." };
  await writeAudit(ctx, { action: "dsr.create", companyId: company.id, companyLabel: companyLabel(company), details: { type: input.type, due_at: dueDate(input.received_at) } });
  return { ok: true, id: data.id };
}

export async function forwardDsr(ctx: PlatformContext, id: string): Promise<{ ok: true; sent: number } | { ok: false; code: string; message: string }> {
  const db = platformDb();
  const { data: r } = await db.from("data_subject_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { ok: false, code: "not_found", message: "Žádost nebyla nalezena." };
  if (r.status !== "received") return { ok: false, code: "bad_state", message: "Žádost už byla předána nebo vyřízena." };
  const { data: company } = await db.from("companies").select("id, name, seq_id").eq("id", r.company_id).maybeSingle();
  const sent = await queueCompanyEmail(
    r.company_id,
    "Žádost subjektu údajů k vyřízení",
    `Dobrý den,\n\nDodio jako zpracovatel obdrželo žádost jedné z osob, jejichž údaje vaše firma v Dodio spravuje (${DSR_TYPE_LABELS[r.type as DsrType].toLowerCase()}). Správcem těchto údajů je vaše firma, proto ji předáváme vám. Prosíme o vyřízení do ${czDate(r.due_at)}. Výmaz uživatele, opravu i export údajů zvládnete v Nastavení firmy → Uživatelé. V případě potíží nám napište.${SIGNATURE}`
  );
  const { error } = await db.from("data_subject_requests").update({ status: "forwarded", forwarded_at: new Date().toISOString() }).eq("id", id).eq("status", "received");
  if (error) return { ok: false, code: "update_failed", message: "Stav se nepodařilo uložit." };
  await writeAudit(ctx, { action: "dsr.forward", companyId: r.company_id, companyLabel: company ? companyLabel(company) : null, details: { type: r.type, sent } });
  return { ok: true, sent };
}

export async function resolveDsr(ctx: PlatformContext, id: string, note: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const db = platformDb();
  const { data: r } = await db.from("data_subject_requests").select("id, company_id, type, status").eq("id", id).maybeSingle();
  if (!r) return { ok: false, code: "not_found", message: "Žádost nebyla nalezena." };
  if (r.status === "resolved") return { ok: false, code: "bad_state", message: "Žádost je už vyřízená." };
  const { data: company } = await db.from("companies").select("id, name, seq_id").eq("id", r.company_id).maybeSingle();
  const { error } = await db.from("data_subject_requests").update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_note: note || null }).eq("id", id).neq("status", "resolved");
  if (error) return { ok: false, code: "update_failed", message: "Stav se nepodařilo uložit." };
  await writeAudit(ctx, { action: "dsr.resolve", companyId: r.company_id, companyLabel: company ? companyLabel(company) : null, details: { type: r.type } });
  return { ok: true };
}
