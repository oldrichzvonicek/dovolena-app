import type { DbProfile } from "@/lib/supabase/types";

type Who = Pick<DbProfile, "role" | "staff_role"> | null | undefined;

/**
 * Who sees what (the database enforces the same rules — this only decides which screens and menu items are offered):
 *  - admin:      everything
 *  - HR:         Analytika, Exporty, Nastavení → Uživatelé (invite, departments/manager/hire date/entitlements) and Historie změn
 *  - accountant: Analytika and Exporty, read only
 */
export const isAdminRole = (p: Who) => p?.role === "admin";
export const isHr = (p: Who) => p?.staff_role === "hr";
export const isAccountant = (p: Who) => p?.staff_role === "accountant";

/** Analytika + Exporty. */
export const canSeeReports = (p: Who) => isAdminRole(p) || !!p?.staff_role;

/** Settings sections the person may open (keys match the `?sekce=` values). */
export function allowedSettingsSections(p: Who): string[] {
  if (isAdminRole(p)) return ["users", "departments", "leave-types", "general", "billing", "integrations", "audit"];
  if (isHr(p)) return ["users", "audit"];
  return [];
}

export const canSeeSettings = (p: Who) => allowedSettingsSections(p).length > 0;
