import { createClient } from "@/lib/supabase/client";

export interface ScopeTarget {
  manager_id: string | null;
  department_id: string | null;
}

export interface DecisionScope {
  /** Admins decide for the whole company. */
  all: boolean;
  /** True when the current user may approve/reject requests of (or book absences for) this person. */
  canDecide: (p: ScopeTarget) => boolean;
}

/**
 * Who a manager may decide for — mirrors is_superior_of() in schema.sql (the database enforces it too):
 * the person's manager, the head / deputy head of their department, or a standing substitute
 * (profiles.substitute_id) of such a manager or head. Admins may decide for everyone.
 */
export async function fetchDecisionScope(me: { id: string; company_id: string; role: string }): Promise<DecisionScope> {
  if (me.role === "admin") return { all: true, canDecide: () => true };
  const supabase = createClient();
  const [{ data: depts }, { data: subFor }] = await Promise.all([
    supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", me.company_id),
    supabase.from("profiles").select("id").eq("company_id", me.company_id).eq("substitute_id", me.id),
  ]);
  const substituted = new Set((subFor ?? []).map((p) => p.id as string)); // people whose standing substitute I am
  const managerIds = new Set<string>([me.id, ...substituted]);
  const headed = new Set(
    (depts ?? [])
      .filter((d) => d.head_profile_id === me.id || d.deputy_head_profile_id === me.id || (d.head_profile_id && substituted.has(d.head_profile_id as string)))
      .map((d) => d.id as string)
  );
  return {
    all: false,
    canDecide: (p) => (!!p.manager_id && managerIds.has(p.manager_id)) || (!!p.department_id && headed.has(p.department_id)),
  };
}

/**
 * Oddělení, za která smí manažer vidět Analytiku: jeho vlastní oddělení, oddělení, kterému je vedoucím / zástupcem
 * (včetně stálého zástupu), a oddělení jeho přímých podřízených. Admin (null) vidí všechna.
 * Data samotná stejně filtruje RLS — soukromé typy absencí (nemoc) uvidí manažer jen u svých podřízených.
 */
export async function fetchAnalyticsDepartmentIds(me: { id: string; company_id: string; role: string; staff_role?: string | null; department_id: string | null }): Promise<Set<string> | null> {
  if (me.role === "admin" || me.staff_role) return null;
  const supabase = createClient();
  const [{ data: depts }, { data: people }] = await Promise.all([
    supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", me.company_id),
    supabase.from("profiles").select("id, manager_id, substitute_id, department_id").eq("company_id", me.company_id).eq("active", true),
  ]);
  const substituted = new Set((people ?? []).filter((p) => p.substitute_id === me.id).map((p) => p.id as string));
  const managerIds = new Set<string>([me.id, ...substituted]);
  const ids = new Set<string>();
  if (me.department_id) ids.add(me.department_id);
  for (const d of depts ?? []) {
    if (d.head_profile_id === me.id || d.deputy_head_profile_id === me.id || (d.head_profile_id && substituted.has(d.head_profile_id as string))) ids.add(d.id as string);
  }
  for (const p of people ?? []) if (p.manager_id && managerIds.has(p.manager_id as string) && p.department_id) ids.add(p.department_id as string);
  return ids;
}
