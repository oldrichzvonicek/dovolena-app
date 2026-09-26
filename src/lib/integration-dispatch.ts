import { createAdminClient } from "@/lib/supabase/admin";
import { type WebhookProvider } from "@/lib/webhooks";
import { postWebhook } from "@/lib/webhooks-send";

/** Zprávy starší než tohle se už neodesílají (po opravě adresy by jinak chat zaplavily zprávy z minulých dnů). */
const MAX_AGE_MS = 24 * 3600_000;

export interface DispatchResult {
  events: number;
  delivered: number;
  failed: number;
  expired: number;
  /** Poslední důvod selhání (třeba „Toto není webhook Slacku…“), ať ho jde ukázat administrátorovi. */
  lastError: string | null;
}

/**
 * Odešle zařazené události z integration_outbox na všechny aktivní webhooky firmy, které je odebírají.
 * Volá se hned po akci uživatele (přes /api/integrations/flush) a jako záloha z plánované úlohy každých 10 minut.
 * S `companyId` se zpracují jen události té firmy.
 */
export async function dispatchIntegrationEvents(companyId?: string): Promise<DispatchResult> {
  const supabase = createAdminClient();
  let q = supabase
    .from("integration_outbox")
    .select("id, company_id, event, text, attempts, created_at")
    .is("sent_at", null)
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(50);
  if (companyId) q = q.eq("company_id", companyId);
  const { data: events } = await q;

  let delivered = 0;
  let failed = 0;
  let expired = 0;
  let lastError: string | null = null;
  for (const ev of events ?? []) {
    if (Date.now() - new Date(ev.created_at as string).getTime() > MAX_AGE_MS) {
      await supabase.from("integration_outbox").update({ sent_at: new Date().toISOString(), error: "vypršelo (starší než 24 hodin)" }).eq("id", ev.id);
      expired++;
      continue;
    }

    // Claim the event first so two overlapping runs never deliver it twice (skipped when the claimed_at column is not deployed yet).
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
    const claim = await supabase
      .from("integration_outbox")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", ev.id)
      .is("sent_at", null)
      .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
      .select("id");
    if (!claim.error && (claim.data ?? []).length === 0) continue;

    const { data: hooks } = await supabase
      .from("webhook_integrations")
      .select("id, provider, url, events")
      .eq("company_id", ev.company_id)
      .eq("active", true);
    const targets = (hooks ?? []).filter((h) => (h.events as string[]).includes(ev.event));

    let allOk = true;
    let evError: string | null = null;
    for (const h of targets) {
      const r = await postWebhook(h.provider as WebhookProvider, h.url, ev.text);
      await supabase.from("webhook_integrations").update({ last_status: r.status, last_sent_at: new Date().toISOString() }).eq("id", h.id);
      if (r.ok) delivered++;
      else {
        allOk = false;
        failed++;
        evError = r.status;
        lastError = r.status;
      }
    }
    if (allOk) await supabase.from("integration_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", ev.id);
    else await supabase.from("integration_outbox").update({ attempts: ev.attempts + 1, error: evError, claimed_at: null }).eq("id", ev.id);
  }
  return { events: events?.length ?? 0, delivered, failed, expired, lastError };
}
