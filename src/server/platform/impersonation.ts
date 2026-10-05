import { platformDb, writeAudit, type PlatformContext } from "./auth";
import { SIGNATURE, queueCompanyEmail } from "./email";
import { companyLabel } from "./companies";

/**
 * „Zobrazit jako admin firmy“ = náhled firmy jen pro čtení. Pravé přihlášení jako uživatel (vlastní JWT) jsme nezvolili:
 * Supabase „přihlásit jako“ nemá a podepisovat vlastní token nemusí projekt dovolit. Náhled proto sestavuje server ze
 * service role dotazů, takže z principu nic nezapíše a nemůže odhalit víc, než smí (typ nemoci je vždy skrytý).
 * Relace je časově omezená (15/30/60 min), vyžaduje důvod a step-up, admin firmy o ní dostane e-mail a každé zobrazení se loguje.
 */
export const MINUTES = [15, 30, 60] as const;
export type ImpersonationMinutes = (typeof MINUTES)[number];

export interface ImpersonationSession {
  id: string;
  admin_id: string;
  company_id: string;
  reason: string;
  note: string | null;
  minutes: number;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
}

export function isActive(s: Pick<ImpersonationSession, "expires_at" | "ended_at">, now = Date.now()): boolean {
  return !s.ended_at && new Date(s.expires_at).getTime() > now;
}

export const isMinutes = (v: unknown): v is ImpersonationMinutes => typeof v === "number" && (MINUTES as readonly number[]).includes(v);

export async function startImpersonation(ctx: PlatformContext, companyId: string, reason: string, note: string | null, minutes: ImpersonationMinutes): Promise<{ ok: true; id: string } | { ok: false; code: string; message: string }> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("id, name, seq_id, status").eq("id", companyId).maybeSingle();
  if (!company) return { ok: false, code: "not_found", message: "Firma nebyla nalezena." };
  if (company.status === "deleted") return { ok: false, code: "company_locked", message: "Firma je smazaná." };

  // Jedna otevřená relace na admina: nová ukončí předchozí.
  await db.from("platform_impersonation_sessions").update({ ended_at: new Date().toISOString() }).eq("admin_id", ctx.userId).is("ended_at", null);
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  const { data: session, error } = await db.from("platform_impersonation_sessions").insert({ admin_id: ctx.userId, company_id: companyId, reason, note, minutes, expires_at: expires }).select("id").single();
  if (error || !session) return { ok: false, code: "insert_failed", message: "Relaci se nepodařilo založit." };

  await writeAudit(ctx, { action: "impersonation.start", companyId, companyLabel: companyLabel(company), details: { reason, note: note ?? undefined, minutes } });
  await queueCompanyEmail(
    companyId,
    "Podpora Dodio si prohlíží váš účet (jen pro čtení)",
    `Dobrý den,\n\npracovník podpory Dodio si na ${minutes} minut zobrazil váš účet v režimu jen pro čtení. Nic nemůže měnit a typ nemoci u lidí nevidí.\nDůvod: ${reason}\n\nPokud o tom nevíte, napište nám.${SIGNATURE}`
  );
  return { ok: true, id: session.id };
}

export async function endImpersonation(ctx: PlatformContext, sessionId: string | null): Promise<boolean> {
  const db = platformDb();
  let q = db.from("platform_impersonation_sessions").update({ ended_at: new Date().toISOString() }).eq("admin_id", ctx.userId).is("ended_at", null);
  if (sessionId) q = q.eq("id", sessionId);
  const { data } = await q.select("id, company_id");
  for (const s of data ?? []) await writeAudit(ctx, { action: "impersonation.end", companyId: s.company_id, viaImpersonation: true });
  return (data?.length ?? 0) > 0;
}

export async function loadSession(ctx: PlatformContext, sessionId: string): Promise<ImpersonationSession | null> {
  const { data } = await platformDb().from("platform_impersonation_sessions").select("*").eq("id", sessionId).eq("admin_id", ctx.userId).maybeSingle();
  return (data as ImpersonationSession | null) ?? null;
}

// ---------------------------------------------------------------------------
// Data náhledu
// ---------------------------------------------------------------------------

export interface ViewPerson {
  id: string;
  name: string;
  email: string | null;
  role: string;
  staff_role: string | null;
  active: boolean;
  department: string | null;
}

export interface ViewAbsence {
  person: string;
  /** „Nepřítomen“ u nemoci a soukromých typů, jinak název typu. */
  label: string;
  masked: boolean;
  start_date: string;
  end_date: string;
  status: string;
  half_day: boolean;
}

export interface CompanyView {
  company: { name: string; seq_id: number; plan: string; work_days: number[]; weekend_operations: boolean; default_vacation_days: number };
  departments: { name: string; people: number }[];
  people: ViewPerson[];
  leaveTypes: { label: string; counts_against: string; requires_approval: boolean; paid: boolean; active: boolean; hidden: boolean }[];
  absences: ViewAbsence[];
  pendingCount: number;
}

/** Skryté typy: nemoc a typy, které firma schovává před kolegy. Jejich název ani délka do náhledu nejdou. */
export function isSensitiveType(t: { counts_against?: string | null; hide_from_colleagues?: boolean | null; key?: string | null }): boolean {
  return t.counts_against === "sick" || !!t.hide_from_colleagues || t.key === "sick";
}

export async function loadCompanyView(companyId: string): Promise<CompanyView | null> {
  const db = platformDb();
  const { data: company } = await db.from("companies").select("name, seq_id, plan, work_days, weekend_operations, default_vacation_days").eq("id", companyId).maybeSingle();
  if (!company) return null;
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: departments }, { data: profiles }, { data: types }] = await Promise.all([
    db.from("departments").select("id, name").eq("company_id", companyId).order("name"),
    db.from("profiles").select("id, name, email, role, staff_role, active, department_id").eq("company_id", companyId).eq("is_demo", false).order("name").limit(1000),
    db.from("leave_types").select("id, key, label, counts_against, hide_from_colleagues, requires_approval, paid, active").eq("company_id", companyId).order("sort_order"),
  ]);
  const deptName = new Map((departments ?? []).map((d) => [d.id, d.name as string]));
  const people = (profiles ?? []) as (ViewPerson & { department_id: string | null })[];
  const typeById = new Map((types ?? []).map((t) => [t.id, t]));
  const ids = people.map((p) => p.id);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const absences: ViewAbsence[] = [];
  let pendingCount = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const { data: reqs } = await db.from("leave_requests").select("profile_id, leave_type_id, start_date, end_date, half_day, status").in("profile_id", ids.slice(i, i + 100)).lte("start_date", to).gte("end_date", from).in("status", ["approved", "pending"]).order("start_date").limit(1000);
    for (const r of reqs ?? []) {
      const t = typeById.get(r.leave_type_id);
      const masked = !t || isSensitiveType(t);
      absences.push({ person: nameOf.get(r.profile_id) ?? "?", label: masked ? "Nepřítomen" : (t!.label as string), masked, start_date: r.start_date, end_date: r.end_date, status: r.status, half_day: r.half_day });
      if (r.status === "pending") pendingCount++;
    }
  }
  absences.sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));

  return {
    company: { name: company.name, seq_id: company.seq_id, plan: company.plan, work_days: company.work_days ?? [1, 2, 3, 4, 5], weekend_operations: !!company.weekend_operations, default_vacation_days: Number(company.default_vacation_days ?? 0) },
    departments: (departments ?? []).map((d) => ({ name: d.name as string, people: people.filter((p) => p.department_id === d.id).length })),
    people: people.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, staff_role: p.staff_role, active: p.active, department: p.department_id ? deptName.get(p.department_id) ?? null : null })),
    leaveTypes: (types ?? []).map((t) => ({ label: t.label as string, counts_against: t.counts_against as string, requires_approval: !!t.requires_approval, paid: !!t.paid, active: !!t.active, hidden: isSensitiveType(t) })),
    absences,
    pendingCount,
  };
}
