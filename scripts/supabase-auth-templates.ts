/**
 * Nahraje české e-maily Supabase Auth (potvrzení e-mailu, obnovení hesla, změna e-mailu)
 * ze složky supabase/email-templates/ do vašeho Supabase projektu přes Management API.
 *
 *   npx tsx scripts/supabase-auth-templates.ts --dry-run          # jen ukáže, co by se nastavilo
 *   npx tsx scripts/supabase-auth-templates.ts                    # nahraje šablony
 *   npx tsx scripts/supabase-auth-templates.ts --enable-confirm   # navíc zapne "Confirm email"
 *
 * Potřebuje osobní přístupový token Supabase v .env.local jako SUPABASE_ACCESS_TOKEN
 * (Supabase → ikona profilu → Account preferences → Access Tokens → Generate new token).
 * Po nahrání token smažte. Referenci projektu vezme z NEXT_PUBLIC_SUPABASE_URL.
 */
import fs from "fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const enableConfirm = args.includes("--enable-confirm");

for (const l of (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "").split(/\r?\n/)) {
  if (l.includes("=") && !l.startsWith("#")) process.env[l.slice(0, l.indexOf("="))] ??= l.slice(l.indexOf("=") + 1).trim();
}

const TEMPLATES = [
  { field: "confirmation", file: "confirm-signup.html", subject: "Potvrďte svůj e-mail — Dodio" },
  { field: "recovery", file: "recovery.html", subject: "Obnovení hesla — Dodio" },
  { field: "email_change", file: "email-change.html", subject: "Potvrďte změnu e-mailu — Dodio" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error("Nepodařilo se zjistit referenci projektu z NEXT_PUBLIC_SUPABASE_URL.");

  const patch: Record<string, unknown> = {};
  for (const t of TEMPLATES) {
    patch[`mailer_subjects_${t.field}`] = t.subject;
    patch[`mailer_templates_${t.field}_content`] = fs.readFileSync(`supabase/email-templates/${t.file}`, "utf8");
  }
  if (enableConfirm) patch.mailer_autoconfirm = false;

  if (dry) {
    console.log(`Projekt: ${ref}`);
    for (const t of TEMPLATES) console.log(`- ${t.field}: „${t.subject}“ (${(patch[`mailer_templates_${t.field}_content`] as string).length} znaků HTML)`);
    console.log(enableConfirm ? "- Confirm email: ZAPNOUT" : "- Confirm email: beze změny");
    console.log("\n(dry-run, nic se neodeslalo)");
    return;
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error("Chybí SUPABASE_ACCESS_TOKEN v .env.local.");
    process.exit(1);
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`Supabase odmítl požadavek (${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`Hotovo: ${TEMPLATES.length} šablon nahráno${enableConfirm ? ", Confirm email zapnut" : ""}.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
