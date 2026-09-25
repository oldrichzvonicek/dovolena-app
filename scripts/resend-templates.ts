/**
 * Nahraje e-mailové šablony Dodia (src/lib/email-templates.ts) do Resendu → Templates.
 *
 *   npx tsx scripts/resend-templates.ts --dry-run     # jen vypíše, co by se nahrálo (klíč není potřeba)
 *   npx tsx scripts/resend-templates.ts               # nahraje a zveřejní (publish)
 *
 * Potřebuje klíč s plným oprávněním v .env.local jako RESEND_FULL_API_KEY (klíč z .env.local pro odesílání
 * umí jen odesílat). Po nahrání klíč v Resendu smažte. Existující šablony se stejným aliasem se aktualizují.
 */
import fs from "fs";
import { EMAIL_TEMPLATES, TEMPLATE_SAMPLE, renderTemplate, type EmailTemplate } from "../src/lib/email-templates";

const dry = process.argv.includes("--dry-run");

function loadEnv() {
  try {
    for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      if (l.includes("=") && !l.startsWith("#")) process.env[l.slice(0, l.indexOf("="))] ??= l.slice(l.indexOf("=") + 1).trim();
    }
  } catch {
    /* no .env.local */
  }
}

// Resend rezervuje některé názvy proměnných (EMAIL, FIRST_NAME…) — přejmenujeme je.
const RESERVED = new Set(["EMAIL", "FIRST_NAME", "LAST_NAME", "CONTACT", "THIS", "RESEND_UNSUBSCRIBE_URL"]);
const keyOf = (v: string) => {
  const k = v.toUpperCase();
  return RESERVED.has(k) ? `UZIVATEL_${k}` : k;
};
const ph = (v: string) => `{{{${keyOf(v)}}}}`;

/** Šablona → objekt pro Resend API (proměnné ve tvaru {{{KLIC}}}). */
export function toResendTemplate(t: EmailTemplate) {
  const placeholders = new Proxy({} as Record<string, string>, { get: (_o, k: string) => ph(k) });
  const rendered = renderTemplate(t.key, placeholders, "__APP_URL__");
  const html = rendered.html.split("__APP_URL__").join("{{{APP_URL}}}");
  const text = rendered.text.split("__APP_URL__").join("{{{APP_URL}}}");
  const vars = Array.from(new Set([...t.vars.map(keyOf), "APP_URL"]));
  return {
    name: `Dodio — ${t.name}`,
    alias: `dodio-${t.key.replace(/_/g, "-")}`,
    from: process.env.EMAIL_FROM ?? "Dodio <info@dodio.cz>",
    subject: rendered.subject,
    html,
    text,
    variables: vars.map((key) => ({
      key,
      type: "string" as const,
      fallback_value: key === "APP_URL" ? "https://app.dodio.cz" : (TEMPLATE_SAMPLE[t.vars.find((v) => keyOf(v) === key) ?? ""] ?? "—"),
    })),
  };
}

async function api(path: string, method: string, key: string, body?: unknown) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json } as { ok: boolean; status: number; json: any };
}

async function main() {
  loadEnv();
  const items = EMAIL_TEMPLATES.map(toResendTemplate);
  if (dry) {
    for (const i of items) console.log(`${i.alias.padEnd(34)} ${i.variables.length} proměnných — ${i.subject}`);
    console.log(`\nCelkem ${items.length} šablon (dry-run, nic se nenahrálo).`);
    return;
  }
  const key = process.env.RESEND_FULL_API_KEY;
  if (!key) {
    console.error("Chybí RESEND_FULL_API_KEY v .env.local (klíč s plným oprávněním).");
    process.exit(1);
  }
  const existing = await api("/templates", "GET", key);
  if (!existing.ok) {
    console.error(`Resend odmítl klíč (${existing.status}): ${existing.json?.message ?? ""}`);
    process.exit(1);
  }
  const byAlias = new Map<string, string>((existing.json.data ?? []).map((t: any) => [t.alias, t.id]));
  let created = 0;
  let updated = 0;
  for (const i of items) {
    const id = byAlias.get(i.alias);
    const r = id ? await api(`/templates/${id}`, "PATCH", key, i) : await api("/templates", "POST", key, i);
    if (!r.ok) {
      console.error(`✗ ${i.alias}: ${r.status} ${r.json?.message ?? ""}`);
      continue;
    }
    const tid = id ?? r.json.id;
    const p = await api(`/templates/${tid}/publish`, "POST", key);
    if (!p.ok) console.error(`  (nepodařilo se zveřejnit ${i.alias}: ${p.status} ${p.json?.message ?? ""})`);
    console.log(`${id ? "↻ aktualizováno" : "✓ vytvořeno"}  ${i.alias}`);
    id ? updated++ : created++;
    await new Promise((res) => setTimeout(res, 600)); // rate limit
  }
  console.log(`\nHotovo: ${created} nových, ${updated} aktualizovaných.`);
}

main();
