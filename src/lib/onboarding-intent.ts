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

const KEY_PREFIX = "dodio:onboarding-intent:";

// Keyed by e-mail, not a single shared key — otherwise two people signing up on the same browser before
// either confirms (shared/kiosk computer, or someone trying the flow twice) would overwrite each other's
// choice, and completeOnboarding would apply the wrong name to whoever logs in first.
const keyFor = (email: string) => KEY_PREFIX + email.trim().toLowerCase();

export function saveOnboardingIntent(email: string, intent: OnboardingIntent) {
  try {
    localStorage.setItem(keyFor(email), JSON.stringify(intent));
  } catch {
    /* private mode — the person will just have to choose again after signing in */
  }
}

export function readOnboardingIntent(email: string): OnboardingIntent | null {
  try {
    const raw = localStorage.getItem(keyFor(email));
    return raw ? (JSON.parse(raw) as OnboardingIntent) : null;
  } catch {
    return null;
  }
}

export function clearOnboardingIntent(email: string) {
  try {
    localStorage.removeItem(keyFor(email));
  } catch {
    /* ignore */
  }
}

/** For the login page's "looks like you just confirmed a signup" nudge, shown before anyone has typed an e-mail. */
export function hasAnyOnboardingIntent(): boolean {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith(KEY_PREFIX));
  } catch {
    return false;
  }
}

/** Creates the profile for a freshly signed-in user who has none: invite by e-mail first, then the remembered intent. Returns true when a profile was created. */
export async function completeOnboarding(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;

  const { data: claimed } = await supabase.rpc("claim_invite");
  if (claimed) {
    if (email) clearOnboardingIntent(email);
    return true;
  }
  if (!email) return false;
  const intent = readOnboardingIntent(email);
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
  clearOnboardingIntent(email);
  return true;
}
