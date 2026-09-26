import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyInviteToken } from "@/lib/invite-token";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Dokončí pozvánku e-mailem: založí účet rovnou jako potvrzený (email_confirm: true). Bez toho by uživatel musel
 * ještě jednou potvrzovat e-mail, i když odkaz z pozvánky je sám o sobě stejně silný důkaz, že adresu vlastní —
 * databázová funkce claim_invite potvrzení e-mailu vyžaduje, tady ho jen zajistíme jinak než druhým e-mailem.
 * Token jen dokazuje, komu adresa patří; přiřazení do firmy provede až claim_invite po přihlášení (RLS, auth.uid()).
 */
export async function POST(req: Request) {
  if (!(await allowRequest(`invite-accept:ip:${clientIp(req.headers)}`, 20, 3600))) return tooManyRequests();

  const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const email = verifyInviteToken(token);
  if (!email) return NextResponse.json({ error: "Odkaz je neplatný nebo vypršel. Požádejte o novou pozvánku." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Heslo musí mít aspoň 8 znaků." }, { status: 400 });
  if (!(await allowRequest(`invite-accept:email:${email}`, 8, 3600))) return tooManyRequests();

  const admin = createAdminClient();
  const { data: invite } = await admin.from("company_invites").select("id").eq("email", email).maybeSingle();
  if (!invite) return NextResponse.json({ error: "Pozvánka už neplatí. Požádejte administrátora firmy o novou." }, { status: 404 });

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    const msg = /already.*registered|already.*exists/i.test(error.message) ? "Pro tento e-mail už účet existuje. Přihlaste se svým heslem." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true, email });
}
