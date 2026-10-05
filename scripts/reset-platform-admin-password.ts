/**
 * Nastaví nové heslo existujícímu administrátorovi super-adminu (když ho zapomenete). Nemění e-mail ani roli.
 * Spuštění (v adresáři projektu, potřebuje .env.local se SUPABASE_SERVICE_ROLE_KEY):
 *
 *   npx tsx scripts/reset-platform-admin-password.ts jmeno@firma.cz
 *
 * Nové heslo: buď PLATFORM_ADMIN_PASSWORD v prostředí, nebo se vygeneruje a vypíše jednou do terminálu.
 * TOTP zůstává nastavené (nemaže se) — po přihlášení novým heslem se rovnou zeptá na kód z aplikace.
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

const email = process.argv[2]?.toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error("Použití: npx tsx scripts/reset-platform-admin-password.ts <e-mail>");
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
  const { data: admin } = await sb.from("platform_admins").select("user_id, active").eq("email", email!).maybeSingle();
  if (!admin) {
    console.error(`${email} není v platform_admins. Nový admin se zakládá skriptem create-platform-admin.ts.`);
    process.exit(1);
  }
  if (!admin.active) console.warn("Pozor: účet je v platform_admins vypnutý (active = false), i s novým heslem se nepřihlásí.");

  const password = process.env.PLATFORM_ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const { error } = await sb.auth.admin.updateUserById(admin.user_id, { password });
  if (error) throw error;

  console.log(`Heslo pro ${email} bylo nastaveno.`);
  console.log(`Nové heslo (zobrazí se jen teď, uložte si ho do správce hesel): ${password}`);
  console.log("Přihlášení: http://admin.localhost:3000 (TOTP zůstává jako dřív).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
