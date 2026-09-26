import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { dispatchIntegrationEvents } from "@/lib/integration-dispatch";
import { allowRequest, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Odešle hned zařazené zprávy do chatů (Slack, Teams …) pro firmu přihlášeného uživatele. Volá se po vytvoření nebo
 * vyřízení žádosti, aby zprávy nečekaly na plánovanou úlohu (ta běží jen jednou za 10 minut). Vrací jen počty.
 */
export async function POST() {
  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
  if (!me?.company_id) return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
  if (!(await allowRequest(`integrations-flush:${user.id}`, 40, 60))) return tooManyRequests();

  const result = await dispatchIntegrationEvents(me.company_id as string);
  return NextResponse.json(result);
}
