import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { allowRequest, tooManyRequests } from "@/lib/rate-limit";
import { EMAIL_TEMPLATES, renderTemplate, TEMPLATE_SAMPLE } from "@/lib/email-templates";
import { appUrl, sendEmail } from "@/lib/email";

/**
 * Testovací e-mail (Nastavení firmy → E-maily → Náhled šablony): pošle šablonu s ukázkovými daty
 * na e-mail PŘIHLÁŠENÉHO admina, ne na libovolnou adresu — nejde to tedy zneužít k rozesílání cizím lidem.
 */
export async function POST(req: NextRequest) {
  const { templateKey } = (await req.json().catch(() => ({}))) as { templateKey?: string };
  const template = EMAIL_TEMPLATES.find((t) => t.key === templateKey);
  if (!template) return NextResponse.json({ error: "Neznámá šablona." }, { status: 400 });

  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Testovací e-mail může poslat jen admin." }, { status: 403 });
  const to = caller.email ?? user.email;
  if (!to) return NextResponse.json({ error: "Účtu chybí e-mailová adresa." }, { status: 400 });

  if (!(await allowRequest(`test-email:${user.id}`, 10, 60))) return tooManyRequests();

  const { subject, text, html } = renderTemplate(template.key, TEMPLATE_SAMPLE, appUrl());
  const result = await sendEmail(to, `[TEST] ${subject}`, text, html);
  if (result.skipped) return NextResponse.json({ error: "RESEND_API_KEY není nastaven — e-maily se zatím jen řadí do fronty." }, { status: 400 });
  if (!result.ok) {
    // result.error je syrová odpověď poskytovatele (JSON, anglicky) — adminovi se nezobrazuje, jen se zaloguje pro ladění.
    console.error("send-test-email selhalo:", result.error);
    return NextResponse.json({ error: "Odeslání se nezdařilo — zkuste to prosím znovu, nebo kontaktujte podporu." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to });
}
