import { createAdminClient } from "@/lib/supabase/admin";
import { postWebhook, type WebhookProvider } from "@/lib/webhooks";

/** Sends queued integration_outbox events to every active webhook of the company that subscribes to the event. */
export async function dispatchIntegrationEvents(): Promise<{ events: number; delivered: number; failed: number }> {
  const supabase = createAdminClient();
  const { data: events } = await supabase
    .from("integration_outbox")
    .select("id, company_id, event, text, attempts")
    .is("sent_at", null)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);

  let delivered = 0;
  let failed = 0;
  for (const ev of events ?? []) {
    const { data: hooks } = await supabase
      .from("webhook_integrations")
      .select("id, provider, url, events")
      .eq("company_id", ev.company_id)
      .eq("active", true);
    const targets = (hooks ?? []).filter((h) => (h.events as string[]).includes(ev.event));

    let allOk = true;
    let lastError: string | null = null;
    for (const h of targets) {
      const r = await postWebhook(h.provider as WebhookProvider, h.url, ev.text);
      await supabase.from("webhook_integrations").update({ last_status: r.status, last_sent_at: new Date().toISOString() }).eq("id", h.id);
      if (r.ok) delivered++;
      else {
        allOk = false;
        failed++;
        lastError = r.status;
      }
    }
    if (allOk) await supabase.from("integration_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", ev.id);
    else await supabase.from("integration_outbox").update({ attempts: ev.attempts + 1, error: lastError }).eq("id", ev.id);
  }
  return { events: events?.length ?? 0, delivered, failed };
}
