/**
 * Změní jméno a/nebo přihlašovací e-mail existujícího administrátora super-adminu (např. nahradí zástupné „Vaše Jméno“
 * a vas@email.cz skutečnými údaji, ať je v audit logu poznat, kdo co udělal). Heslo, role ani TOTP se nemění.
 * Spuštění (v adresáři projektu, potřebuje .env.local se SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx scripts/update-platform-admin.ts stary@email.cz --email novy@firma.cz --name "Jméno Příjmení"
 *
 * Změna se zapíše do platform_audit_log. Nový e-mail se rovnou potvrdí (bez ověřovacího e-mailu), takže se s ním dá hned přihlásit.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env: Record<string, string> = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const args = process.argv.slice(2);
const current = args.find((a) => !a.startsWith("--"))?.toLowerCase();
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const newEmail = flag("email")?.toLowerCase();
const newName = flag("name");

const emailOk = (e?: string) => !!e && /^\S+@\S+\.\S+$/.test(e);
if (!emailOk(current) || (!newEmail && !newName) || (newEmail && !emailOk(newEmail))) {
  console.error('Použití: npx tsx scripts/update-platform-admin.ts <současný e-mail> [--email <nový e-mail>] [--name "Jméno"]');
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: admin } = await sb.from("platform_admins").select("user_id, email, name").eq("email", current!).maybeSingle();
  if (!admin) {
    console.error(`${current} není v platform_admins.`);
    process.exit(1);
  }

  if (newEmail && newEmail !== admin.email) {
    const { data: clash } = await sb.from("platform_admins").select("user_id").eq("email", newEmail).maybeSingle();
    if (clash) {
      console.error(`${newEmail} už používá jiný admin.`);
      process.exit(1);
    }
    const { data: profile } = await sb.from("profiles").select("id").eq("id", admin.user_id).maybeSingle();
    if (profile) {
      console.error("Účet má profil ve firmě, admin platformy nesmí být zároveň uživatelem firmy.");
      process.exit(1);
    }
    const { error } = await sb.auth.admin.updateUserById(admin.user_id, { email: newEmail, email_confirm: true });
    if (error) throw error;
  }

  const patch: Record<string, string> = {};
  if (newEmail) patch.email = newEmail;
  if (newName !== undefined) patch.name = newName;
  const { error } = await sb.from("platform_admins").update(patch).eq("user_id", admin.user_id);
  if (error) throw error;

  await sb.from("platform_audit_log").insert({
    actor_type: "system",
    actor_label: "skript update-platform-admin",
    action: "team.update",
    details: { admin: admin.email, email: newEmail ? { from: admin.email, to: newEmail } : undefined, name: newName !== undefined ? { from: admin.name, to: newName } : undefined },
  });

  console.log(`Hotovo: ${admin.email} → ${newEmail ?? admin.email}${newName !== undefined ? `, jméno „${newName}“` : ""}.`);
  if (newEmail) console.log("Přihlašujte se novým e-mailem, heslo i TOTP zůstávají.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
