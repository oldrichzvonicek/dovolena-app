import { NextResponse } from "next/server";
import { Resend } from "resend";

// Sends the free Excel template as a download link via e-mail. Requires
// RESEND_API_KEY (server-only secret, set in the hosting environment) and a
// domain verified in Resend for LEAD_MAGNET_FROM_EMAIL to actually deliver
// to arbitrary recipients — without that, Resend only delivers to the
// account owner's own address.
const FROM_EMAIL = "Dodio <sablony@dodio.cz>";
const TEMPLATE_PATH = "/sablony/dodio-evidence-pracovni-doby-a-dovolene-2027.xlsx";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Odesílání e-mailů zatím není nastavené." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const templateUrl = `${origin}${TEMPLATE_PATH}`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Vaše šablona pro evidenci docházky 2027 — Dodio",
      html: `
        <p>Dobrý den,</p>
        <p>posíláme šablonu pro evidenci pracovní doby, dovolené, sick days a home office pro rok 2027.</p>
        <p><a href="${templateUrl}">Stáhnout šablonu (.xlsx)</a></p>
        <p>Tým Dodio</p>
      `,
    });

    if (error) {
      console.error("Resend send failed", error);
      return NextResponse.json({ error: "Nepodařilo se odeslat e-mail, zkuste to prosím znovu." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend send failed", error);
    return NextResponse.json({ error: "Nepodařilo se odeslat e-mail, zkuste to prosím znovu." }, { status: 502 });
  }
}
