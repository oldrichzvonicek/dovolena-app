export type Role = "employee" | "manager" | "admin";
export type RequestStatus = "pending" | "approved" | "rejected";
export type LeaveColor = "teal" | "rust" | "moss" | "violet" | "amber";

export interface DbCompany {
  id: string;
  name: string;
  created_at: string;
}

export interface DbDepartment {
  id: string;
  company_id: string;
  name: string;
}

export interface DbProfile {
  id: string;
  company_id: string;
  department_id: string | null;
  manager_id: string | null;
  name: string;
  role: Role;
  avatar_initials: string | null;
}

export interface DbLeaveType {
  id: string;
  company_id: string;
  key: string;
  label: string;
  color: LeaveColor;
  counts_against: "vacation" | "sick" | "none";
}

export interface DbLeaveEntitlement {
  id: string;
  profile_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
}

export interface DbLeaveRequest {
  id: string;
  profile_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  working_days: number;
  status: RequestStatus;
  note: string | null;
  covering_profile_id: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}
