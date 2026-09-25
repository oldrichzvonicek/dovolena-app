import { createClient } from "@/lib/supabase/client";
import { fetchCompany } from "@/lib/admin-data";
import { loadBalances, remainingOf } from "@/lib/balances";
import { reducesPresence } from "@/lib/leave-kinds";

export interface ApprovalCheckRow {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  counts_against: string;
  type_key?: string;
  profile: { id: string; department_id: string | null };
}

export interface ApprovalWarnings {
  /** Balance left AFTER approving (negative = employee goes into minus). */
  remaining: Record<string, number>;
  /** Share of the requester's department out on these dates if approved, when it reaches the warning threshold. */
  capacity: Record<string, { percent: number; count: number; size: number }>;
}

/** Shared by the Ke schválení page and the dashboard shortcut so both warn identically. */
export async function computeApprovalWarnings(companyId: string, rows: ApprovalCheckRow[]): Promise<ApprovalWarnings> {
  const supabase = createClient();
  const balances = await loadBalances(companyId);

  const remaining: Record<string, number> = {};
  for (const r of rows) {
    if (r.counts_against !== "vacation" && r.counts_against !== "sick") continue;
    remaining[r.id] = remainingOf(balances.get(r.profile.id, r.counts_against)) - Number(r.working_days);
  }

  // A department can override the company-wide threshold (departments.capacity_warning_percent).
  const company = await fetchCompany(companyId);
  const { data: depts } = await supabase.from("departments").select("id, capacity_warning_percent").eq("company_id", companyId);
  const thresholds = new Map((depts ?? []).map((d) => [d.id, d.capacity_warning_percent ?? company.capacity_warning_percent]));
  const { data: allProfiles } = await supabase.from("profiles").select("id, department_id").eq("company_id", companyId).eq("active", true);
  const { data: deptApproved } = await supabase
    .from("leave_requests")
    .select("profile_id, start_date, end_date, leave_type:leave_types(key), profile:profiles!leave_requests_profile_id_fkey(department_id)")
    .eq("status", "approved");

  type DeptReq = { profile_id: string; start_date: string; end_date: string; leave_type: { key: string } | null; profile: { department_id: string | null } | null };
  const sizes = new Map<string, number>();
  for (const p of (allProfiles as unknown as { id: string; department_id: string | null }[]) ?? []) {
    if (p.department_id) sizes.set(p.department_id, (sizes.get(p.department_id) ?? 0) + 1);
  }
  const approved = ((deptApproved as unknown as DeptReq[]) ?? []).filter((a) => reducesPresence(a.leave_type?.key));

  const capacity: ApprovalWarnings["capacity"] = {};
  for (const r of rows) {
    if (!reducesPresence(r.type_key)) continue;
    const deptId = r.profile.department_id;
    if (!deptId) continue;
    const size = sizes.get(deptId) ?? 0;
    if (size === 0) continue;
    const overlapping = new Set(
      approved.filter((a) => a.profile?.department_id === deptId && a.start_date <= r.end_date && a.end_date >= r.start_date).map((a) => a.profile_id)
    );
    overlapping.add(r.profile.id);
    const percent = Math.round((overlapping.size / size) * 100);
    if (percent >= (thresholds.get(deptId) ?? company.capacity_warning_percent)) {
      capacity[r.id] = { percent, count: overlapping.size, size };
    }
  }

  return { remaining, capacity };
}

/** True when someone other than `selfId` can approve — self-approval is only allowed for the sole approver of a company. */
export async function hasOtherApprover(companyId: string, selfId: string): Promise<boolean> {
  const { count } = await createClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("role", ["manager", "admin"])
    .eq("active", true)
    .neq("id", selfId);
  return (count ?? 0) > 0;
}

/** Departments the user heads or deputizes for — "their team" for approvals and the Můj tým scope (a deputy covers the head). */
export async function fetchMyDepartmentIds(companyId: string, profileId: string): Promise<Set<string>> {
  const { data } = await createClient()
    .from("departments")
    .select("id, head_profile_id, deputy_head_profile_id")
    .eq("company_id", companyId);
  return new Set((data ?? []).filter((d) => d.head_profile_id === profileId || d.deputy_head_profile_id === profileId).map((d) => d.id as string));
}
