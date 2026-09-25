import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { postWebhook, validateWebhookUrl, type WebhookProvider } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/** Admin-only: sends a test message through a saved webhook (or validates a URL that isn't saved yet). */
export async function POST(req: Request) {
  const supabase = createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Nepřihlášeno." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Jen admin firmy." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; url?: string; provider?: WebhookProvider };
  let url = body.url;
  let provider = body.provider;
  if (body.id) {
    // RLS limits this to the caller's own company.
    const { data: row } = await supabase.from("webhook_integrations").select("url, provider").eq("id", body.id).single();
    if (!row) return NextResponse.json({ error: "Integrace nenalezena." }, { status: 404 });
    url = row.url;
    provider = row.provider as WebhookProvider;
  }
  if (!url || !provider) return NextResponse.json({ error: "Chybí adresa nebo služba." }, { status: 400 });

  const invalid = validateWebhookUrl(url, provider);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const r = await postWebhook(provider, url, "✅ Dodio: testovací zpráva — napojení funguje.");
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
