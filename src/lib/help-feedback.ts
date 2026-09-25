import { createClient } from "@/lib/supabase/client";

/** 👍/👎 on a Nápověda answer — write-only from the client, nothing reads it back yet. */
export async function submitHelpFeedback(profileId: string, question: string, helpful: boolean) {
  const supabase = createClient();
  const { error } = await supabase.from("help_feedback").insert({ profile_id: profileId, question, helpful });
  if (error) throw error;
}
