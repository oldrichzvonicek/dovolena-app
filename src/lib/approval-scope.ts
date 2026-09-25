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
