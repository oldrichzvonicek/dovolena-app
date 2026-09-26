import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/email";
import { signInviteToken } from "@/lib/invite-token";
import { allowRequest, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Vrátí odkaz k dokončení pozvánky (s podepsaným tokenem), pro admina či HR, kteří ho chtějí poslat sami místo
 * automatického e-mailu. Jen na adresu, která má v jejich firmě skutečně založenou čekající pozvánku.
 */
export async function POST(req: Request) {
  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("company_id, role, staff_role").eq("id", user.id).single();
  if (!me?.company_id) return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
  if (me.role !== "admin" && me.staff_role !== "hr") return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  if (!(await allowRequest(`invite-link:${user.id}`, 40, 3600))) return tooManyRequests();

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Chybí e-mail." }, { status: 400 });

  const { data: invite } = await supabase.from("company_invites").select("id").eq("company_id", me.company_id).eq("email", email).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Pro tento e-mail nemáte založenou pozvánku." }, { status: 404 });

  const url = `${appUrl()}/login?zvan=${encodeURIComponent(email)}&t=${signInviteToken(email)}`;
  return NextResponse.json({ url });
}
