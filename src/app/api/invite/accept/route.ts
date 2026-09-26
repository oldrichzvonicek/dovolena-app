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
  if (!error) return NextResponse.json({ ok: true, email });
  if (!/already.*registered|already.*exists/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });

  // E-mail už v auth.users existuje. Nejčastěji jde o nedokončený pokus z dřívějška (čekal na potvrzovací e-mail,
  // který se nikdy neposlal) — takový účet dokončíme, protože platný token je stejný důkaz vlastnictví adresy.
  // Skutečně dokončený (potvrzený) účet ale nepřepisujeme — supabase-js nemá vyhledání podle e-mailu, projdeme stránky.
  const abandoned = await findUnconfirmedUser(admin, email);
  if (!abandoned) return NextResponse.json({ error: "Pro tento e-mail už účet existuje. Přihlaste se svým heslem." }, { status: 400 });

  const { error: repairError } = await admin.auth.admin.updateUserById(abandoned.id, { password, email_confirm: true });
  if (repairError) return NextResponse.json({ error: repairError.message }, { status: 400 });
  return NextResponse.json({ ok: true, email });
}

async function findUnconfirmedUser(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.email_confirmed_at ? null : hit;
    if (data.users.length < 200) return null;
  }
  return null;
}
