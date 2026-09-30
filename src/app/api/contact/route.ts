import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildContactNotificationEmailHtml, buildContactNotificationEmailText } from "@/lib/contact-email";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

// Forwards a contact-form submission to the team inbox. Requires
// RESEND_API_KEY (server-only secret) and a domain verified in Resend —
// see api/lead-magnet/route.ts for the same constraint.
const FROM_EMAIL = "Dodio web <web@dodio.cz>";
const MAX_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Odesílání e-mailů zatím není nastavené." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || name.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ error: "Zadejte prosím jméno." }, { status: 400 });
  }
  if (!isValidEmail(email) || email.length > MAX_FIELD_LENGTH) {
    return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  }
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "Zadejte prosím zprávu." }, { status: 400 });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `Nová zpráva z webu – ${name}`,
      html: buildContactNotificationEmailHtml({ name, email, message }),
      text: buildContactNotificationEmailText({ name, email, message }),
    });

    if (error) {
      console.error("Resend send failed", error);
      return NextResponse.json({ error: "Nepodařilo se odeslat zprávu, zkuste to prosím znovu." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend send failed", error);
    return NextResponse.json({ error: "Nepodařilo se odeslat zprávu, zkuste to prosím znovu." }, { status: 502 });
  }
}
