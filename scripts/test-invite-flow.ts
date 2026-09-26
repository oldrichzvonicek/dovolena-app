/**
 * Ověří opravený tok pozvánky e-mailem: token (invite-token.ts), založení potvrzeného účtu
 * (email_confirm: true) a že claim_invite() ho pak správně zařadí do firmy — bez druhého potvrzovacího e-mailu.
 * Vytváří a po sobě maže vlastní zkušební firmu. Spuštění:  npx tsx scripts/test-invite-flow.ts
 */
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { signInviteToken, verifyInviteToken } from "../src/lib/invite-token";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
process.env.APPROVAL_TOKEN_SECRET = env.APPROVAL_TOKEN_SECRET;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const PASSWORD = "Zz-" + crypto.randomUUID();
const stamp = Date.now();
const out: string[] = [];
const check = (name: string, ok: boolean) => out.push(`${ok ? "OK  " : "FAIL"} ${name}`);

async function main() {
  const { data: company, error: companyErr } = await sb.from("companies").insert({ name: "ZZ invite flow (smazat)", plan: "free" }).select().single();
  if (companyErr || !company) {
    console.error("Nepodařilo se založit zkušební firmu (zkontrolujte SUPABASE_SERVICE_ROLE_KEY v .env.local):", companyErr?.message);
    process.exit(1);
  }
  const cid = company.id as string;
  let userId: string | null = null;
  try {
    const email = `zz-invite-${stamp}@zz.dodio.invalid`;

    // 1) Token round-trips the e-mail (co dělá /api/invite/send a /api/invite/verify).
    const token = signInviteToken(email);
    check("token: ověří se a vrátí stejný e-mail", verifyInviteToken(token) === email);
    check("token: cizí/neplatný token se odmítne", verifyInviteToken(token + "x") === null);

    // 2) Admin (přes CSV/jednotlivé přidání) založí čekající pozvánku.
    const { error: invErr } = await sb.from("company_invites").insert({
      company_id: cid,
      email,
      name: "ZZ Nováček",
      role: "employee",
      vacation_total: 20,
      sick_total: 5,
    });
    check("pozvánka: založena bez chyby", !invErr);

    // 3) /api/invite/accept: založí účet rovnou jako potvrzený (žádný druhý e-mail).
    const { data: created, error: createErr } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    check("accept: účet vznikl bez chyby", !createErr && !!created?.user);
    userId = created?.user?.id ?? null;
    check("accept: e-mail je rovnou potvrzený (email_confirmed_at)", !!created?.user?.email_confirmed_at);

    // 4) Klient se tímto heslem přihlásí a zavolá claim_invite() — stejně jako handleInvitee po úspěšném acceptu.
    const c: SupabaseClient = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { error: signInErr } = await c.auth.signInWithPassword({ email, password: PASSWORD });
    check("přihlášení novým heslem: bez chyby", !signInErr);

    const { data: claimedCompanyId, error: claimErr } = await c.rpc("claim_invite");
    check("claim_invite: proběhne bez chyby (email_confirmed_at už je nastavené)", !claimErr);
    check("claim_invite: vrátí správnou firmu", claimedCompanyId === cid);

    const { data: profile } = await sb.from("profiles").select("company_id, role, name").eq("id", userId!).maybeSingle();
    check("profil: vznikl ve správné firmě s rolí employee", profile?.company_id === cid && profile?.role === "employee");

    const { data: leftoverInvite } = await sb.from("company_invites").select("id").eq("company_id", cid).eq("email", email).maybeSingle();
    check("pozvánka: po převzetí smazána", !leftoverInvite);

    // 5) Druhé přijetí stejného tokenu už nemá co udělat (uživatel/pozvánka neexistuje) — accept endpoint by vrátil chybu.
    const { data: invite2 } = await sb.from("company_invites").select("id").eq("email", email).maybeSingle();
    check("opětovné přijetí: pozvánka už neexistuje (accept by vrátil 404)", !invite2);
  } finally {
    if (userId) await sb.auth.admin.deleteUser(userId).catch(() => {});
    await sb.from("companies").delete().eq("id", cid);
    console.log(out.join("\n"));
    const fails = out.filter((l) => l.startsWith("FAIL")).length;
    console.log(`\n${fails === 0 ? "VŠE OK" : `${fails} CHYB`} (${out.length} kontrol)`);
  }
}

main();
