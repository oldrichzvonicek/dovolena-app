import { createClient } from "@/lib/supabase/client";

/** 👍/👎 on a Nápověda answer — write-only from the client, nothing reads it back yet. */
export async function submitHelpFeedback(profileId: string, question: string, helpful: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("help_feedback").insert({ profile_id: profileId, question, helpful });
  if (error) throw error;
}

const VIEWED_KEY = "dodio:help-viewed";

/** Zapíše otevření článku (jednou za návštěvu prohlížeče) — podle toho se řadí „Nejčastější dotazy“. */
export async function trackHelpView(profileId: string, question: string) {
  try {
    const seen: string[] = JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? "[]");
    if (seen.includes(question)) return;
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...seen, question]));
  } catch {
    /* sessionStorage nedostupné — jen se může zapsat víckrát */
  }
  // Statistika nesmí nikdy rušit čtení nápovědy.
  await createClient().from("help_views").insert({ profile_id: profileId, question });
}

/** Nejčastěji otevírané články ve firmě; při chybě (chybějící SQL) prázdný seznam = použije se ruční výběr. */
export async function fetchTopQuestions(limit = 10): Promise<{ question: string; views: number }[]> {
  const { data, error } = await createClient().rpc("help_top_questions", { p_limit: limit });
  if (error) return [];
  return ((data as { question: string; views: number | string }[]) ?? []).map((r) => ({ question: r.question, views: Number(r.views) }));
}
