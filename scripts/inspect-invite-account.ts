/**
 * Diagnostika jednoho konkrétního e-mailu v pozvánkovém toku: je v auth.users, je potvrzený, má profil, má
 * čekající pozvánku. Jen čte, nic nemění. Spuštění:  npx tsx scripts/inspect-invite-account.ts <e-mail>
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const target = (process.argv[2] ?? "").trim().toLowerCase();
if (!target) {
  console.error("Použití: npx tsx scripts/inspect-invite-account.ts <e-mail>");
  process.exit(1);
}

async function main() {
  let user: { id: string; email: string | undefined; email_confirmed_at: string | null | undefined; created_at: string } | null = null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers selhalo:", error.message);
      break;
    }
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) {
      user = { id: hit.id, email: hit.email, email_confirmed_at: hit.email_confirmed_at, created_at: hit.created_at };
      break;
    }
    if (data.users.length < 200) break;
  }

  console.log("auth.users:", user ? `nalezen (id ${user.id}), potvrzen: ${!!user.email_confirmed_at}, založen: ${user.created_at}` : "nenalezen");

  if (user) {
    const { data: profile } = await sb.from("profiles").select("id, company_id, name, role, active").eq("id", user.id).maybeSingle();
    console.log("profiles:", profile ? `existuje — firma ${profile.company_id}, role ${profile.role}, aktivní: ${profile.active}` : "neexistuje");
  }

  const { data: invites } = await sb.from("company_invites").select("id, company_id, name, role, created_at").eq("email", target);
  console.log("company_invites:", invites && invites.length > 0 ? invites.map((i) => `firma ${i.company_id}, role ${i.role}, založeno ${i.created_at}`).join(" | ") : "žádná čekající pozvánka");
}

main();
