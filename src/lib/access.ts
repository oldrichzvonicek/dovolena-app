import type { DbProfile } from "@/lib/supabase/types";
import { CHAT_INTEGRATIONS_ENABLED } from "@/lib/plans";

type Who = Pick<DbProfile, "role" | "staff_role"> | null | undefined;

/**
 * Who sees what (the database enforces the same rules — this only decides which screens and menu items are offered):
 *  - admin:      everything
 *  - HR:         Analytika, Exporty, Nastavení → Lidé (invite, departments/manager/hire date/entitlements,
 *                aktivace/deaktivace), E-maily (jen přehled pro HR a připomínky), Historie změn, Můj tým
 *                (za celou firmu) a zadání absence za kohokoli — ale ne Ke schválení (neschvaluje žádosti)
 *  - accountant: jen Mzdy a Exporty (read only) — žádná Analytika ani přehled kolegů na nástěnce
 *  - manager:    Analytika, ale jen za svá oddělení (bez Exportů)
 */
export const isAdminRole = (p: Who) => p?.role === "admin";
export const isHr = (p: Who) => p?.staff_role === "hr";
export const isAccountant = (p: Who) => p?.staff_role === "accountant";

/** Exporty (mzdové podklady, uzávěrka, vyrovnání). */
export const canSeeReports = (p: Who) => isAdminRole(p) || !!p?.staff_role;

/** Smart HR (přehledy pro vedení lidí): admin a HR. Manažer a účetní ho nevidí. */
export const canSeeInsights = (p: Who) => isAdminRole(p) || isHr(p);

/** Analytika: admin, HR za celou firmu, manažer jen za svá oddělení (výběr dat řeší OverviewPanel). Účetní ne —
 *  ta má vidět jen Mzdy a Exporty, ne přehledy a "kdo dnes chybí" o kolezích. */
export const canSeeAnalytics = (p: Who) => isAdminRole(p) || isHr(p) || p?.role === "manager";

/** Settings sections the person may open (keys match the `?sekce=` values). */
export function allowedSettingsSections(p: Who): string[] {
  if (isAdminRole(p))
    return [
      "prehled",
      "profile",
      "users",
      "departments",
      "leave-types",
      "naroky",
      "pravidla",
      "kalendar",
      "emails",
      "bezpecnost",
      "billing",
      ...(CHAT_INTEGRATIONS_ENABLED ? ["integrations"] : []),
      "audit",
      "zaznamy-emaily",
    ];
  if (isHr(p)) return ["users", "emails", "audit"];
  return [];
}

export const canSeeSettings = (p: Who) => allowedSettingsSections(p).length > 0;
