import { isOverdue, todayIso } from "./billing";
import { platformDb, writeAudit } from "./auth";
import { SIGNATURE, czDate, queueCompanyEmail } from "./email";
import { setCompanyStatus } from "./status";

/**
 * Upomínky po splatnosti: 1. po 3 dnech, 2. po 7, poslední po 14; po 21 dnech se firma pozastaví (jen pro čtení).
 * Každý krok se zapíše do dunning_events (jednou na fakturu), takže se neposílá dvakrát.
 */
export type DunningStep = "reminder_1" | "reminder_2" | "reminder_3" | "suspend";

export const DUNNING_DAYS: Record<DunningStep, number> = { reminder_1: 3, reminder_2: 7, reminder_3: 14, suspend: 21 };
const ORDER: DunningStep[] = ["reminder_1", "reminder_2", "reminder_3", "suspend"];

export function daysOverdue(dueAt: string, today: string): number {
  return Math.floor((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${dueAt}T12:00:00Z`).getTime()) / 86_400_000);
}

/** Nejvyšší krok, který už nastal a ještě neproběhl (nižší kroky se nedohánějí, aby firma nedostala tři e-maily naráz). */
export function nextDunningStep(days: number, done: ReadonlySet<string>): DunningStep | null {
  for (const step of [...ORDER].reverse()) {
    if (days >= DUNNING_DAYS[step]) return done.has(step) ? null : step;
  }
  return null;
}

export const MANUAL_REMINDER_COOLDOWN_MS = 24 * 3_600_000;

function reminderText(step: DunningStep | "manual", number: string, amount: number, dueAt: string, days: number): { subject: string; body: string } {
  const kc = `${Math.round(amount).toLocaleString("cs-CZ")} Kč`;
  const base = `faktura č. ${number} na ${kc} měla být uhrazena do ${czDate(dueAt)}.`;
  switch (step) {
    case "reminder_1":
    case "manual":
      return { subject: `Připomenutí platby faktury ${number}`, body: `Dobrý den,\n\nu vaší firmy evidujeme neuhrazenou fakturu: ${base} Pokud jste už zaplatili, tento e-mail prosím ignorujte.${SIGNATURE}` };
    case "reminder_2":
      return { subject: `Druhá upomínka: faktura ${number} po splatnosti`, body: `Dobrý den,\n\n${base} Je po splatnosti ${days} dní. Prosíme o úhradu, případně nás kontaktujte.${SIGNATURE}` };
    case "reminder_3":
      return { subject: `Poslední upomínka: faktura ${number}`, body: `Dobrý den,\n\n${base} Je po splatnosti ${days} dní. Pokud nebude uhrazena do 7 dní, účet vaší firmy přepneme do režimu jen pro čtení.${SIGNATURE}` };
    default:
      return { subject: `Účet Dodio je pozastaven (faktura ${number})`, body: `Dobrý den,\n\nkvůli neuhrazené faktuře č. ${number} (${kc}, splatnost ${czDate(dueAt)}) je účet vaší firmy v režimu jen pro čtení. Po uhrazení ho ihned obnovíme. Data zůstávají zachována.${SIGNATURE}` };
  }
}

export interface DunningSummary {
  reminders: number;
  suspended: number;
}

export async function runDunning(): Promise<DunningSummary> {
  const db = platformDb();
  const today = todayIso();
  const { data: invoices } = await db.from("company_invoices").select("id, company_id, number, amount, due_at, status").eq("status", "issued").lt("due_at", today);
  const overdue = ((invoices ?? []) as { id: string; company_id: string; number: string; amount: number; due_at: string; status: string }[]).filter((i) => isOverdue(i, today));
  const summary: DunningSummary = { reminders: 0, suspended: 0 };
  if (overdue.length === 0) return summary;

  const { data: events } = await db.from("dunning_events").select("invoice_id, step").in("invoice_id", overdue.map((i) => i.id));
  const doneBy = new Map<string, Set<string>>();
  for (const e of (events ?? []) as { invoice_id: string; step: string }[]) doneBy.set(e.invoice_id, (doneBy.get(e.invoice_id) ?? new Set()).add(e.step));
  const { data: companies } = await db.from("companies").select("id, status, is_test").in("id", Array.from(new Set(overdue.map((i) => i.company_id))));
  const companyOf = new Map(((companies ?? []) as { id: string; status: string; is_test: boolean }[]).map((c) => [c.id, c]));

  for (const inv of overdue) {
    const company = companyOf.get(inv.company_id);
    if (!company || company.is_test || company.status === "pending_deletion" || company.status === "deleted") continue;
    const days = daysOverdue(inv.due_at, today);
    const step = nextDunningStep(days, doneBy.get(inv.id) ?? new Set());
    if (!step) continue;
    // Záznam se založí první: unikátní index zabrání dvojímu odeslání, kdyby běžely dva běhy naráz.
    const { error } = await db.from("dunning_events").insert({ invoice_id: inv.id, company_id: inv.company_id, step });
    if (error) continue;
    const text = reminderText(step, inv.number, Number(inv.amount), inv.due_at, days);
    await queueCompanyEmail(inv.company_id, text.subject, text.body);
    summary.reminders++;
    if (step === "suspend" && company.status === "active") {
      const r = await setCompanyStatus(null, inv.company_id, "suspended", { action: "company.suspend", details: { reason: "unpaid_invoice", invoice: inv.number, daysOverdue: days } });
      if (r.ok) summary.suspended++;
    }
    await writeAudit(null, { action: `dunning.${step}`, companyId: inv.company_id, details: { invoice: inv.number, daysOverdue: days } });
  }
  return summary;
}

/** Ruční upomínka k jedné faktuře: nejvýš jednou za 24 hodin. Vrací null, když je ještě brzy. */
export async function sendManualReminder(invoiceId: string): Promise<{ ok: true; sent: number } | { ok: false; code: "not_found" | "bad_state" | "reminder_too_soon" }> {
  const db = platformDb();
  const { data: inv } = await db.from("company_invoices").select("id, company_id, number, amount, due_at, status").eq("id", invoiceId).maybeSingle();
  if (!inv) return { ok: false, code: "not_found" };
  if (inv.status !== "issued") return { ok: false, code: "bad_state" };
  const { data: last } = await db.from("dunning_events").select("sent_at").eq("invoice_id", invoiceId).eq("step", "manual").order("sent_at", { ascending: false }).limit(1);
  if (last?.[0] && Date.now() - new Date(last[0].sent_at).getTime() < MANUAL_REMINDER_COOLDOWN_MS) return { ok: false, code: "reminder_too_soon" };
  const today = todayIso();
  const days = inv.due_at ? Math.max(0, daysOverdue(inv.due_at, today)) : 0;
  const text = reminderText("manual", inv.number, Number(inv.amount), inv.due_at ?? today, days);
  const sent = await queueCompanyEmail(inv.company_id, text.subject, text.body);
  await db.from("dunning_events").insert({ invoice_id: invoiceId, company_id: inv.company_id, step: "manual" });
  return { ok: true, sent };
}
