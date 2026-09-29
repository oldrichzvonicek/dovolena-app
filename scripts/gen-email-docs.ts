/**
 * Přegeneruje docs/EMAIL_TEMPLATES.md ze src/lib/email-templates.ts (zdroj pravdy).
 *   npx tsx scripts/gen-email-docs.ts
 * Úvod (do prvního „## “) a část o systémových e-mailech Supabase (od „## Systémové“) zůstávají, přegenerují se jen šablony.
 */
import fs from "fs";
import { EMAIL_TEMPLATES, TEMPLATE_SAMPLE, renderTemplate, type EmailTemplate } from "../src/lib/email-templates";

const path = "docs/EMAIL_TEMPLATES.md";
const old = fs.readFileSync(path, "utf8");
const head = old.slice(0, old.indexOf("\n## ")).trimEnd() + "\n";
const tail = old.slice(old.indexOf("## Systémové e-maily Supabase"));

function section(t: EmailTemplate) {
  const r = renderTemplate(t.key, TEMPLATE_SAMPLE, "https://app.dodio.cz");
  const vars = t.vars.length ? t.vars.map((v) => `\`{${v}}\``).join(", ") : "žádné";
  const quoted = r.text
    .split("\n")
    .map((l) => `> ${l}`.trimEnd() + (l === "" ? " " : ""))
    .join("\n");
  return `### ${t.name}\n\n- **Kdy:** ${t.when}\n- **Komu:** ${t.to}\n- **Proměnné:** ${vars}\n- **Předmět (ukázka):** ${r.subject}\n\n${quoted}\n`;
}

const groups: [string, (t: EmailTemplate) => boolean, string][] = [
  ["Už dnes odchází", (t) => t.live, ""],
  ["Připraveno k zapojení", (t) => !t.live && !t.marketing && !t.dormant, ""],
  ["Úvodní série „Co Dodio umí“ (zatím se neposílá)", (t) => !!t.marketing, "Obchodní sdělení: před spuštěním je potřeba odhlašovací odkaz a vlastní kategorie v Nastavení → E-maily. Adminům jde pět e-mailů ve dnech 1, 3, 6, 10 a 14, zaměstnancům dva (den 1 a 4).\n\n"],
  ["Uspané (patří k dočasně vypnuté funkci)", (t) => !!t.dormant, "\n"],
];

let out = head;
for (const [title, pick, intro] of groups) {
  const list = EMAIL_TEMPLATES.filter(pick);
  if (list.length === 0) continue;
  out += `\n## ${title}\n\n${intro}${list.map(section).join("\n")}`;
}
fs.writeFileSync(path, `${out.trimEnd()}\n\n${tail}`);
console.log(`Zapsáno ${EMAIL_TEMPLATES.length} šablon do ${path}`);
