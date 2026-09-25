import { createClient } from "@/lib/supabase/client";
import { DbDepartment, DbLeaveRequest, DbLeaveType, DbProfile } from "@/lib/supabase/types";

const supabase = createClient();

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchDepartments(companyId: string): Promise<DbDepartment[]> {
  const { data, error } = await supabase.from("departments").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data;
}

export async function fetchLeaveTypes(companyId: string): Promise<DbLeaveType[]> {
  const { data, error } = await supabase.from("leave_types").select("*").eq("company_id", companyId).order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchColleagues(companyId: string): Promise<DbProfile[]> {
  const { data, error } = await supabase.from("profiles").select("*").eq("company_id", companyId).eq("active", true);
  if (error) throw error;
  return data;
}

/** All leave requests for the company, with the requester's name/department joined in. */
export interface LeaveRequestWithProfile extends DbLeaveRequest {
  profile: { id: string; name: string; avatar_initials: string | null; department_id: string | null };
}

export async function fetchLeaveRequests(): Promise<LeaveRequestWithProfile[]> {
  // No explicit company filter needed here — RLS on leave_requests already
  // restricts rows to requests whose profile is in the caller's company.
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*, profile:profiles!leave_requests_profile_id_fkey(id, name, avatar_initials, department_id)")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data as unknown as LeaveRequestWithProfile[];
}

export async function fetchEntitlements(profileId: string, year: number) {
  const { data, error } = await supabase
    .from("leave_entitlements")
    .select("*, leave_type:leave_types(*)")
    .eq("profile_id", profileId)
    .eq("year", year);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createLeaveRequest(payload: {
  profile_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  note?: string;
  covering_profile_id?: string | null;
  status?: "pending" | "approved";
}) {
  const { error } = await supabase.from("leave_requests").insert(payload);
  if (error) throw error;
}

export async function approveLeaveRequest(id: string, approverId: string) {
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "approved", approved_by: approverId })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectLeaveRequest(id: string, approverId: string, reason: string) {
  if (!reason.trim()) throw new Error("Uveďte důvod zamítnutí.");
  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "rejected", approved_by: approverId, rejection_reason: reason })
    .eq("id", id);
  if (error) throw error;
}

/** Employee asks to cancel an already-approved future absence — notifies managers/admins. */
export async function requestLeaveCancellation(id: string) {
  const { error } = await supabase.rpc("request_leave_cancellation", { p_request_id: id });
  if (error) throw error;
}

/** Manager/admin decision on a cancellation request: approve deletes the absence, reject keeps it. */
export async function resolveLeaveCancellation(id: string, approve: boolean) {
  const { error } = await supabase.rpc("resolve_leave_cancellation", { p_request_id: id, p_approve: approve });
  if (error) throw error;
}

/** Withdraws a still-pending request. */
export async function cancelLeaveRequest(id: string) {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id).eq("status", "pending");
  if (error) throw error;
}

/** Edits a still-pending request in place (only the owner, only while pending — enforced by RLS). */
export async function updateLeaveRequest(
  id: string,
  payload: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    half_day: boolean;
    working_days: number;
    note?: string | null;
    covering_profile_id?: string | null;
    }
) {
  const { error } = await supabase.from("leave_requests").update(payload).eq("id", id).eq("status", "pending");
  if (error) throw error;
}

/** A colleague's private absence (e.g. sick leave): only who and when — the type is hidden by RLS. */
export interface MaskedAbsence {
  id: string;
  profile_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  status: "approved" | "pending";
}

/** Dates-only absences the caller may not see in full. Empty for admins/superiors of the person. */
export async function fetchMaskedAbsences(from?: string, to?: string): Promise<MaskedAbsence[]> {
  const args: { p_from?: string; p_to?: string } = {};
  if (from) args.p_from = from;
  if (to) args.p_to = to;
  const { data, error } = await supabase.rpc("masked_absences", args);
  if (error) return []; // function not deployed yet — behave as before
  return ((data as MaskedAbsence[]) ?? []).map((r) => ({ ...r, working_days: Number(r.working_days) }));
}
