import { createClient } from "@/lib/supabase/client";

/** Registrační odkaz firmy: tajný kód (ne číslo firmy), který admin může vypnout nebo vygenerovat znovu. */
export interface JoinLinkInfo {
  join_code: string;
  enabled: boolean;
  require_approval: boolean;
}

export const joinUrl = (code: string) => `${window.location.origin}/login?pozvanka=${code}`;

export async function fetchJoinLink(): Promise<JoinLinkInfo | null> {
  const { data, error } = await createClient().rpc("get_join_link");
  if (error) throw error;
  const row = (data as JoinLinkInfo[] | null)?.[0];
  return row ?? null;
}

export async function setJoinLink(enabled: boolean, requireApproval: boolean, regenerate = false) {
  const { error } = await createClient().rpc("set_join_link", { p_enabled: enabled, p_require_approval: requireApproval, p_regenerate: regenerate });
  if (error) throw error;
}

export async function publicCompanyNameByCode(code: string): Promise<string | null> {
  const { data, error } = await createClient().rpc("public_company_name_by_code", { p_code: code });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function joinCompanyByCode(code: string, name: string): Promise<string> {
  const { data, error } = await createClient().rpc("join_company_by_code", { p_code: code, p_name: name });
  if (error) throw error;
  return data as string;
}

/** Copies the current link; returns a Czech reason string when it can't (link off, no permission, clipboard blocked). */
export async function copyJoinLink(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const info = await fetchJoinLink();
    if (!info) return { ok: false, reason: "Registrační odkaz není k dispozici." };
    if (!info.enabled) return { ok: false, reason: "Registrační odkaz je vypnutý. Admin ho zapne v Nastavení firmy → Uživatelé." };
    await navigator.clipboard.writeText(joinUrl(info.join_code));
    return { ok: true };
  } catch {
    return { ok: false, reason: "Odkaz se nepodařilo zkopírovat." };
  }
}
