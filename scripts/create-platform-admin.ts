/**
 * Založí (nebo povýší) administrátora super-adminu Dodio: uživatele v Supabase Auth + řádek v platform_admins.
 * Spuštění (v adresáři projektu, potřebuje .env.local se SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx scripts/create-platform-admin.ts jmeno@firma.cz --role super_admin --name "Jméno Příjmení"
 *
 * Heslo: buď PLATFORM_ADMIN_PASSWORD v prostředí, nebo se vygeneruje a vypíše jednou do terminálu.
 * Při prvním přihlášení si admin nastaví TOTP (povinné). Účet, který už je zákaznický (má řádek v profiles), se odmítne.
 * Role: super_admin | support | billing.
 */
import fs from "node:fs";
import crypto from "node:crypto";
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
const email = args.find((a) => !a.startsWith("--"))?.toLowerCase();
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const role = flag("role") ?? "super_admin";
const name = flag("name") ?? "";

if (!email || !/^\S+@\S+\.\S+$/.test(email) || !["super_admin", "support", "billing"].includes(role)) {
  console.error("Použití: npx tsx scripts/create-platform-admin.ts <e-mail> [--role super_admin|support|billing] [--name \"Jméno\"]");
  process.exit(1);
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserId(mail: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === mail);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  let userId = await findUserId(email!);
  let generated: string | null = null;

  if (userId) {
    const { data: profile } = await sb.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (profile) {
      console.error(`Účet ${email} je zákaznický (má profil ve firmě). Použijte jiný e-mail — admin platformy nesmí být zároveň uživatelem firmy.`);
      process.exit(1);
    }
    console.log("Účet v Supabase Auth už existuje, heslo se nemění.");
  } else {
    const password = process.env.PLATFORM_ADMIN_PASSWORD || (generated = crypto.randomBytes(12).toString("base64url"));
    const { data, error } = await sb.auth.admin.createUser({ email: email!, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Účet se nepodařilo vytvořit.");
    userId = data.user.id;
  }

  const { error } = await sb.from("platform_admins").upsert({ user_id: userId, email: email!, name, role, active: true }, { onConflict: "user_id" });
  if (error) {
    console.error("Zápis do platform_admins selhal (je nasazená migrace 20260928000000_platform_phase1.sql?):", error.message);
    process.exit(1);
  }
  console.log(`Hotovo: ${email} je ${role}.`);
  if (generated) console.log(`Heslo (zobrazí se jen teď, uložte si ho do správce hesel): ${generated}`);
  console.log("Přihlášení: http://admin.localhost:3000  (při prvním přihlášení se nastaví TOTP)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
