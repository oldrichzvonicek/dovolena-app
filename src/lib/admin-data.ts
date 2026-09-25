import { createClient } from "@/lib/supabase/client";
import { DbBlackoutPeriod, DbCompany, DbCompanyInvoice, LeaveColor, Role } from "@/lib/supabase/types";

const supabase = createClient();

// ---------------------------------------------------------------------------
// Company settings
// ---------------------------------------------------------------------------

export async function fetchCompany(companyId: string): Promise<DbCompany> {
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
  if (error) throw error;
  return data;
}

export async function updateCompany(companyId: string, patch: Partial<DbCompany>) {
  const { error } = await supabase.from("companies").update(patch).eq("id", companyId);
  if (error) throw error;
}

/** @deprecated use updateCompany(companyId, { weekend_operations }) */
export async function updateCompanyWeekendOperations(companyId: string, weekendOperations: boolean) {
  await updateCompany(companyId, { weekend_operations: weekendOperations });
}

/** Uploads to company-logos/<companyId>/logo.<ext>, replacing any existing file, and saves the public URL on the company row. */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${companyId}/logo.${ext}`;
  const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`; // cache-bust so a re-upload shows immediately
  await updateCompany(companyId, { logo_url: url });
  return url;
}

/** Removes any uploaded logo file(s) for this company (extension unknown at this point, so the whole folder is cleared) and unsets logo_url. */
export async function deleteCompanyLogo(companyId: string) {
  const { data: files, error: listError } = await supabase.storage.from("company-logos").list(companyId);
  if (listError) throw listError;
  if (files && files.length > 0) {
    const { error: removeError } = await supabase.storage.from("company-logos").remove(files.map((f) => `${companyId}/${f.name}`));
    if (removeError) throw removeError;
  }
  await updateCompany(companyId, { logo_url: null });
}

// ---------------------------------------------------------------------------
// Blackout periods
// ---------------------------------------------------------------------------

export async function fetchBlackoutPeriods(companyId: string): Promise<DbBlackoutPeriod[]> {
  const { data, error } = await supabase
    .from("blackout_periods")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createBlackoutPeriod(companyId: string, payload: { label: string; start_date: string; end_date: string }) {
  const { error } = await supabase.from("blackout_periods").insert({ company_id: companyId, ...payload });
  if (error) throw error;
}

export async function deleteBlackoutPeriod(id: string) {
  const { error } = await supabase.from("blackout_periods").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Company invoices — read-only from the app's side. These are invoices
// Dodio itself issues a company for using the service; there's no
// billing/subscription system yet, so rows are only ever added from the
// platform side (service role), never by a company's own admin — see the
// select-only RLS policy in schema.sql.
// ---------------------------------------------------------------------------

export async function fetchCompanyInvoices(companyId: string): Promise<DbCompanyInvoice[]> {
  const { data, error } = await supabase
    .from("company_invoices")
    .select("*")
    .eq("company_id", companyId)
    .order("issue_date", { ascending: false });
  if (error) throw error;
  return data;
}

/** Signed URL for a private invoice file, valid for a short time — generated on demand, not stored. */
export async function invoiceFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("company-invoices").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Company-wide leave ("celozávodní dovolená") — books the same approved
// leave for every employee at once (e.g. a Christmas shutdown).
// ---------------------------------------------------------------------------

export async function createCompanyWideLeave(
  companyId: string,
  payload: {
    leave_type_id: string;
    start_date: string;
    end_date: string;
    working_days: number;
    note: string;
    department_ids?: string[] | null;
  }
): Promise<number> {
  const { data, error } = await supabase.rpc("create_company_wide_leave", {
    target_company_id: companyId,
    target_leave_type_id: payload.leave_type_id,
    p_start_date: payload.start_date,
    p_end_date: payload.end_date,
    p_working_days: payload.working_days,
    p_note: payload.note,
    target_department_ids: payload.department_ids ?? null,
  });
  if (error) throw error;
  return data as number;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface AdminEmployeeRow {
  id: string;
  name: string;
  email: string | null;
  role: "employee" | "manager" | "admin";
  department_id: string | null;
  manager_id: string | null;
  substitute_id: string | null;
  avatar_initials: string | null;
  active?: boolean;
}

export async function fetchCompanyEmployees(companyId: string): Promise<AdminEmployeeRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, department_id, manager_id, substitute_id, avatar_initials, active")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

/** Leaver: keeps the profile and its history, removes access (RLS treats an inactive profile as having no company). */
export async function setEmployeeActive(id: string, active: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ active, deactivated_at: active ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateEmployeeRole(id: string, role: AdminEmployeeRow["role"]) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateEmployeeDepartment(id: string, departmentId: string | null) {
  const { error } = await supabase.from("profiles").update({ department_id: departmentId }).eq("id", id);
  if (error) throw error;
}

export async function updateEmployeeManager(id: string, managerId: string | null) {
  const { error } = await supabase.from("profiles").update({ manager_id: managerId }).eq("id", id);
  if (error) throw error;
}

export async function updateEmployeeSubstitute(id: string, substituteId: string | null) {
  const { error } = await supabase.from("profiles").update({ substitute_id: substituteId }).eq("id", id);
  if (error) throw error;
}

/** Deletes a company member entirely (auth user + profile) via the server route — the anon client can't delete auth.users rows itself. */
export async function deleteEmployee(targetProfileId: string) {
  const res = await fetch("/api/admin/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetProfileId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Smazání se nezdařilo.");
}

/** Manager/admin booking leave on someone's behalf (e.g. a phoned-in sick day) — created already approved. */
export async function bookLeaveForEmployee(
  approverId: string,
  payload: {
    profile_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    half_day: boolean;
    working_days: number;
    note?: string;
  }
) {
  const { error } = await supabase
    .from("leave_requests")
    .insert({ ...payload, status: "approved", approved_by: approverId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Entitlements (per employee, per leave type, per year)
// ---------------------------------------------------------------------------

export interface EntitlementMap {
  [profileId: string]: { [leaveTypeId: string]: number };
}

export async function fetchCompanyEntitlements(companyId: string, year: number): Promise<EntitlementMap> {
  const { data, error } = await supabase
    .from("leave_entitlements")
    .select("profile_id, leave_type_id, total_days, leave_type:leave_types!inner(company_id)")
    .eq("year", year)
    .eq("leave_type.company_id", companyId);
  if (error) throw error;

  const map: EntitlementMap = {};
  for (const row of data as unknown as { profile_id: string; leave_type_id: string; total_days: number }[]) {
    map[row.profile_id] ??= {};
    map[row.profile_id][row.leave_type_id] = Number(row.total_days);
  }
  return map;
}

export async function upsertEntitlement(profileId: string, leaveTypeId: string, year: number, totalDays: number) {
  const { error } = await supabase
    .from("leave_entitlements")
    .upsert({ profile_id: profileId, leave_type_id: leaveTypeId, year, total_days: totalDays }, { onConflict: "profile_id,leave_type_id,year" });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function createDepartment(companyId: string, name: string, headProfileId?: string | null) {
  const { error } = await supabase
    .from("departments")
    .insert({ company_id: companyId, name, head_profile_id: headProfileId ?? null });
  if (error) throw error;
}

export async function renameDepartment(id: string, name: string) {
  const { error } = await supabase.from("departments").update({ name }).eq("id", id);
  if (error) throw error;
}

/** Reassigns every member of `id` to `targetDepartmentId` (or unsets their department if null), then deletes it — so nobody is silently orphaned. */
export async function deleteDepartment(id: string, targetDepartmentId: string | null) {
  const { error: reassignError } = await supabase
    .from("profiles")
    .update({ department_id: targetDepartmentId })
    .eq("department_id", id);
  if (reassignError) throw reassignError;
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDepartmentHead(id: string, headProfileId: string | null) {
  const { error } = await supabase.from("departments").update({ head_profile_id: headProfileId }).eq("id", id);
  if (error) throw error;
}

export async function updateDepartmentDeputyHead(id: string, deputyHeadProfileId: string | null) {
  const { error } = await supabase.from("departments").update({ deputy_head_profile_id: deputyHeadProfileId }).eq("id", id);
  if (error) throw error;
}

export async function updateDepartmentColor(id: string, color: LeaveColor) {
  const { error } = await supabase.from("departments").update({ color }).eq("id", id);
  if (error) throw error;
}

export async function updateDepartmentCapacity(id: string, capacityWarningPercent: number | null) {
  const { error } = await supabase.from("departments").update({ capacity_warning_percent: capacityWarningPercent }).eq("id", id);
  if (error) throw error;
}

/** Merges departments that share a name (case-insensitively) — e.g. left behind by a retried import that partly failed. Returns how many duplicate rows were merged away. */
export async function mergeDuplicateDepartments(companyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const d of data as { id: string; name: string; created_at: string }[]) {
    const key = d.name.trim().toLowerCase();
    const arr = groups.get(key) ?? [];
    arr.push(d);
    groups.set(key, arr);
  }

  let merged = 0;
  for (const rows of groups.values()) {
    if (rows.length <= 1) continue;
    const [canonical, ...dupes] = rows;
    for (const dup of dupes) {
      const { error: e1 } = await supabase.from("profiles").update({ department_id: canonical.id }).eq("department_id", dup.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("company_invites").update({ department_id: canonical.id }).eq("department_id", dup.id);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("departments").delete().eq("id", dup.id);
      if (e3) throw e3;
      merged++;
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Leave types
// ---------------------------------------------------------------------------

export async function createLeaveType(
  companyId: string,
  payload: { key: string; label: string; color: LeaveColor; counts_against: "vacation" | "sick" | "none" }
) {
  const { error } = await supabase.from("leave_types").insert({ company_id: companyId, ...payload });
  if (error) throw error;
}

export async function updateLeaveType(
  id: string,
  payload: Partial<{
    label: string;
    color: LeaveColor;
    counts_against: "vacation" | "sick" | "none";
    active: boolean;
    requires_approval: boolean;
    auto_approve_max_days: number | null;
    paid: boolean;
    requires_attachment: boolean;
    allow_half_day: boolean;
    allow_hours: boolean;
    hide_from_colleagues: boolean;
  }>
) {
  const { error } = await supabase.from("leave_types").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteLeaveType(id: string) {
  const { error } = await supabase.from("leave_types").delete().eq("id", id);
  if (error) throw error;
}

/** Swaps sort_order between two leave types (move up/down in Typy absencí and request pickers). */
/** Persists a full manual ordering (drag & drop): sort_order = position in the given id list. */
export async function setLeaveTypeOrder(ids: string[]) {
  const results = await Promise.all(ids.map((id, i) => supabase.from("leave_types").update({ sort_order: i }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function swapLeaveTypeOrder(a: { id: string; sort_order: number }, b: { id: string; sort_order: number }) {
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("leave_types").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("leave_types").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
}

// ---------------------------------------------------------------------------
// Company invite link
// ---------------------------------------------------------------------------

export async function joinExistingCompany(companyId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_existing_company", {
    target_company_id: companyId,
    p_name: name,
  });
  if (error) throw error;
  return data as string;
}

export async function publicCompanyName(companyId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("public_company_name", { target_company_id: companyId });
  if (error) throw error;
  return data as string | null;
}

// ---------------------------------------------------------------------------
// Pending invites (single add or bulk CSV import) — people added to the
// company who haven't signed up yet. claimInvite() is called right after a
// new user's first sign-up to turn a matching invite into their real profile.
// ---------------------------------------------------------------------------

export interface CompanyInviteRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  department_id: string | null;
  manager_id: string | null;
  manager_invite_email: string | null;
  vacation_total: number;
  vacation_opening_used: number;
  sick_total: number;
  sick_opening_used: number;
}

export async function fetchCompanyInvites(companyId: string): Promise<CompanyInviteRow[]> {
  const { data, error } = await supabase
    .from("company_invites")
    .select(
      "id, email, name, role, department_id, manager_id, manager_invite_email, vacation_total, vacation_opening_used, sick_total, sick_opening_used"
    )
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export interface NewInvitePayload {
  email: string;
  name: string;
  department_name: string | null;
  manager_id: string | null;
  manager_invite_email: string | null;
  vacation_total: number;
  vacation_opening_used: number;
  sick_total: number;
  sick_opening_used: number;
  role?: Role;
}

/** Runs as a single DB transaction (see import_employees in schema.sql) — either every row (and any new department it needs) is written, or none is. */
export async function importEmployees(companyId: string, rows: NewInvitePayload[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase.rpc("import_employees", { target_company_id: companyId, rows });
  if (error) throw error;
  return data as number;
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from("company_invites").delete().eq("id", id);
  if (error) throw error;
}

/** Call right after a fresh sign-up. Returns the joined company id, or null if this email had no pending invite. */
export async function claimInvite(): Promise<string | null> {
  const { data, error } = await supabase.rpc("claim_invite");
  if (error) throw error;
  return data as string | null;
}
