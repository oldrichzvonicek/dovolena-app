import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type NotificationType = "request_created" | "request_approved" | "request_rejected" | "vacation_reminder" | "help_question" | "cancellation_requested" | "cancellation_resolved";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  leave_request_id: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, leave_request_id, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(profileId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("read_at", null);
  if (error) throw error;
}

/** Admin-only bulk nudge for employees sitting on a large unused vacation balance near year-end. */
export async function sendVacationReminders(profileIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("send_vacation_reminders", { target_profile_ids: profileIds });
  if (error) throw error;
  return data as number;
}

/** "Napsat na HR/Podporu" — pings every manager/admin in the caller's company with a free-text question. */
export async function sendHelpQuestion(message: string): Promise<number> {
  const { data, error } = await supabase.rpc("send_help_question", { p_message: message });
  if (error) throw error;
  return data as number;
}

/** Friendly nudge to one colleague (manager/admin only) — delivered as an in-app notification. */
export async function sendWellbeingReminder(profileId: string) {
  const { error } = await supabase.rpc("send_wellbeing_reminder", { target_profile_id: profileId });
  if (error) throw error;
}
