import { createClient } from "@/lib/supabase/client";
import { DbProfile } from "@/lib/supabase/types";
import { createLeaveRequest } from "@/lib/data";
import { hasOtherApprover } from "@/lib/approval-checks";
import { flushIntegrations } from "@/lib/integrations-client";

/**
 * "Naplánovat rok dopředu, bez odeslání ke schválení" — soukromá poznámka jen pro autora, v samostatné
 * tabulce leave_plans (viz supabase/migrations/20260929050000_leave_plans.sql), ne v leave_requests. Nikdo
 * jiný (ani nadřízený, ani admin) ji nevidí; RLS to vynucuje na úrovni databáze, ne jen v UI.
 */
export interface LeavePlan {
  id: string;
  profile_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note: string | null;
  created_at: string;
  leave_type: { id: string; key: string; label: string; color: string; requires_approval: boolean; auto_approve_max_days: number | null };
}

export async function fetchLeavePlans(profileId: string): Promise<LeavePlan[]> {
  const { data, error } = await createClient()
    .from("leave_plans")
    .select(
      "id, profile_id, leave_type_id, start_date, end_date, half_day, working_days, note, created_at, leave_type:leave_types(id, key, label, color, requires_approval, auto_approve_max_days)"
    )
    .eq("profile_id", profileId)
    .order("start_date", { ascending: true });
  // Dokud uživatel nespustí novou migraci, tabulka ještě neexistuje — ať sekce v appce tiše zůstane
  // prázdná, ne aby shodila celou stránku Moje žádosti chybou.
  if (error) return [];
  return (data as unknown as LeavePlan[]) ?? [];
}

export async function createLeavePlan(payload: {
  profile_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note?: string | null;
}) {
  const { error } = await createClient().from("leave_plans").insert(payload);
  if (error) throw error;
}

export async function deleteLeavePlan(id: string) {
  const { error } = await createClient().from("leave_plans").delete().eq("id", id);
  if (error) throw error;
}

/**
 * "Podat žádost" u návrhu: založí skutečnou žádost (stejná logika automatického schválení jako v
 * RequestLeaveModal — jediný schvalovatel firmy nebo typ bez nutnosti schválení / pod limitem se schválí
 * rovnou) a návrh smaže. Dvěma kroky, ne přepnutím stavu návrhu — leave_requests má vlastní INSERT trigger
 * (upozornění schvalovateli); díky novému řádku ho spustí přesně tak, jako by šlo o čerstvě podanou žádost.
 */
export async function submitLeavePlan(plan: LeavePlan, profile: DbProfile): Promise<"approved" | "pending"> {
  const topApprover = profile.role === "admin" && !(await hasOtherApprover(profile.company_id, profile.id));
  const autoApproved =
    topApprover || plan.leave_type.requires_approval === false || (plan.leave_type.auto_approve_max_days != null && plan.working_days <= Number(plan.leave_type.auto_approve_max_days));

  await createLeaveRequest({
    profile_id: profile.id,
    leave_type_id: plan.leave_type_id,
    start_date: plan.start_date,
    end_date: plan.end_date,
    half_day: plan.half_day,
    working_days: plan.working_days,
    note: plan.note ?? undefined,
    status: autoApproved ? "approved" : "pending",
  });
  await deleteLeavePlan(plan.id);
  flushIntegrations();
  return autoApproved ? "approved" : "pending";
}
