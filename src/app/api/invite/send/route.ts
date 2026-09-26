import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { appUrl, sendEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email-templates";
import { allowRequest, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Odešle pozvánku e-mailem lidem, které admin nebo HR právě pozval. Posílá se jen na adresy, které mají v jeho firmě
 * skutečně založenou čekající pozvánku (přístup řeší RLS), takže přes tento endpoint nejde rozesílat libovolná pošta.
 */
export async function POST(req: Request) {
  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("name, company_id, role, staff_role").eq("id", user.id).single();
  if (!me?.company_id) return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
  if (me.role !== "admin" && me.staff_role !== "hr") return NextResponse.json({ error: "Nemáte oprávnění." }, { status: 403 });
  if (!(await allowRequest(`invite-send:${user.id}`, 20, 3600))) return tooManyRequests();

  const body = (await req.json().catch(() => null)) as { emails?: unknown } | null;
  const wanted = Array.isArray(body?.emails) ? body.emails.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).slice(0, 200) : [];
  if (wanted.length === 0) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

  const [{ data: invites }, { data: company }] = await Promise.all([
    supabase.from("company_invites").select("email, name").eq("company_id", me.company_id).in("email", wanted),
    supabase.from("companies").select("name").eq("id", me.company_id).single(),
  ]);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const inv of invites ?? []) {
    const r = renderTemplate(
      "invite",
      { jmeno: (inv.name as string).split(" ")[0], pozvatel: me.name as string, firma: (company?.name as string) ?? "vaše firma", odkaz: `${appUrl()}/login` },
      appUrl()
    );
    const res = await sendEmail(inv.email as string, r.subject, r.text, r.html);
    if (res.skipped) skipped++;
    else if (res.ok) sent++;
    else failed++;
  }
  return NextResponse.json({ sent, failed, skipped });
}
