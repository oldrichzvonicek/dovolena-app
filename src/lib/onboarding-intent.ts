import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When "Confirm email" is on, sign-up returns no session — the person confirms the address and signs in later.
 * The choice they made on the sign-up form (found a company / join by link) is remembered here and applied
 * on the first sign-in that has no profile yet.
 */
export interface OnboardingIntent {
  kind: "create" | "join";
  name: string;
  companyName?: string;
  joinCode?: string;
}

const KEY = "dodio:onboarding-intent";

export function saveOnboardingIntent(intent: OnboardingIntent) {
  try {
    localStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    /* private mode — the person will just have to choose again after signing in */
  }
}

export function readOnboardingIntent(): OnboardingIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingIntent) : null;
  } catch {
    return null;
  }
}

export function clearOnboardingIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Creates the profile for a freshly signed-in user who has none: invite by e-mail first, then the remembered intent. Returns true when a profile was created. */
export async function completeOnboarding(supabase: SupabaseClient): Promise<boolean> {
  const { data: claimed } = await supabase.rpc("claim_invite");
  if (claimed) {
    clearOnboardingIntent();
    return true;
  }
  const intent = readOnboardingIntent();
  if (!intent) return false;
  if (intent.kind === "join" && intent.joinCode) {
    const { error } = await supabase.rpc("join_company_by_code", { p_code: intent.joinCode, p_name: intent.name });
    if (error) throw error;
  } else if (intent.kind === "create" && intent.companyName) {
    const { error } = await supabase.rpc("onboard_new_company", { p_company_name: intent.companyName, p_admin_name: intent.name });
    if (error) throw error;
  } else {
    return false;
  }
  clearOnboardingIntent();
  return true;
}
