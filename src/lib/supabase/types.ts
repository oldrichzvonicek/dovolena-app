export type Role = "employee" | "manager" | "admin";
export type RequestStatus = "pending" | "approved" | "rejected";
export type LeaveColor =
  | "teal"
  | "rust"
  | "moss"
  | "violet"
  | "amber"
  | "sky"
  | "plum"
  | "sage"
  | "gold"
  | "wine"
  | "slate"
  | "forest";
export type ShiftPattern = "none" | "two_shift" | "three_shift";

export interface DbCompany {
  id: string;
  name: string;
  weekend_operations: boolean;
  shift_pattern: ShiftPattern;
  standard_daily_hours: number;
  work_days: number[];
  min_advance_days: number;
  min_advance_threshold_days: number;
  backdating_allowed: boolean;
  backdating_max_days: number;
  allow_negative_balance: boolean;
  max_negative_balance_days: number;
  carryover_expiry_md: string | null;
  max_carryover_days: number | null;
  capacity_warning_percent: number;
  approval_reminder_hours: number | null;
  default_vacation_days: number;
  default_sick_days: number;
  default_home_office_days: number;
  prorate_new_hires: boolean;
  seniority_enabled: boolean;
  seniority_rules: { years: number; extra_days: number }[];
  plan: string;
  addons: string[];
  logo_url: string | null;
  created_at: string;
}

export interface DbDepartment {
  id: string;
  company_id: string;
  name: string;
  head_profile_id: string | null;
  deputy_head_profile_id: string | null;
  color: LeaveColor;
  capacity_warning_percent: number | null;
}

export interface DbBlackoutPeriod {
  id: string;
  company_id: string;
  label: string;
  start_date: string;
  end_date: string;
}

export interface DbCompanyInvoice {
  id: string;
  company_id: string;
  number: string;
  issue_date: string;
  amount: number;
  currency: string;
  file_url: string | null;
  created_at: string;
}

export interface DbProfile {
  id: string;
  company_id: string;
  department_id: string | null;
  manager_id: string | null;
  substitute_id: string | null;
  name: string;
  role: Role;
  avatar_initials: string | null;
  email: string | null;
  active: boolean;
  email_notifications: boolean;
  staff_role: "hr" | "accountant" | null;
  join_pending: boolean;
}

export interface DbLeaveType {
  id: string;
  company_id: string;
  key: string;
  label: string;
  color: LeaveColor;
  counts_against: "vacation" | "sick" | "none";
  active: boolean;
  requires_approval: boolean;
  auto_approve_max_days: number | null;
  paid: boolean;
  allow_half_day: boolean;
  allow_hours: boolean;
  hide_from_colleagues: boolean;
  counts_as_present: boolean;
  sort_order: number;
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
  cancellation_requested_at: string | null;
}
