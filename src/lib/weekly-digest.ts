// Text týdenního přehledu absencí pro manažery a adminy (api/cron/daily). Čistá funkce, ať jde otestovat bez databáze.
// Nadpisy skupin jsou odstavce "## Název" (vykreslí je renderParagraph v email-templates.ts), seznamy odstavce z "• " řádků.

import { czForm, weeklyDigestIntro } from "@/lib/czech";

export interface DigestRow {
  start_date: string;
  end_date: string;
  profileId: string;
  name: string;
  label: string;
  /** Typ se kolegům neukazuje (nemoc) — v přehledu je jen „Nepřítomen“. */
  hidden: boolean;
  /** Typ, u kterého je člověk v práci (Home Office, služební cesta) — nepočítá se mezi chybějící. */
  present: boolean;
}

const MAX_PER_GROUP = 12;
const WEEKDAY = ["ne", "po", "út", "st", "čt", "pá", "so"];

/** „pá 16. 10.“ */
function day(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}. ${m}.`;
}

const range = (s: string, e: string) => (s === e ? day(s) : `${day(s)} – ${day(e)}`);

/** „12.–18. 10.“ nebo „29. 10. – 4. 11.“ */
function period(from: string, to: string): string {
  const [, fm, fd] = from.split("-").map(Number);
  const [, tm, td] = to.split("-").map(Number);
  return fm === tm ? `${fd}.–${td}. ${fm}.` : `${fd}. ${fm}. – ${td}. ${tm}.`;
}

export function buildWeeklyDigest(opts: { rows: DigestRow[]; pending: number; firstName: string; from: string; to: string }) {
  const groups = new Map<string, { label: string; present: boolean; rows: DigestRow[] }>();
  for (const r of opts.rows) {
    const label = r.hidden ? "Nepřítomen" : r.label;
    const key = `${r.present}|${label}`;
    if (!groups.has(key)) groups.set(key, { label, present: r.present, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  const people = (rows: DigestRow[]) => new Set(rows.map((r) => r.profileId)).size;
  const all = [...groups.values()].map((g) => ({ ...g, count: people(g.rows) }));
  // Skutečné absence nahoře (nejpočetnější první), Home Office a podobné až dole.
  const sorted = [...all.filter((g) => !g.present), ...all.filter((g) => g.present)].sort(
    (a, b) => Number(a.present) - Number(b.present) || b.count - a.count || a.label.localeCompare(b.label, "cs")
  );
  const missing = new Set(opts.rows.filter((r) => !r.present).map((r) => r.profileId)).size;

  const parts = [`Dobré ráno ${opts.firstName},`, weeklyDigestIntro(missing, opts.pending)];
  for (const g of sorted) {
    parts.push(`## ${g.present ? `${g.label} (${g.count})` : g.label}`);
    const rows = [...g.rows].sort((a, b) => a.start_date.localeCompare(b.start_date) || a.name.localeCompare(b.name, "cs"));
    const lines = rows.slice(0, MAX_PER_GROUP).map((r) => `• ${r.name} — ${range(r.start_date, r.end_date)}`);
    const rest = rows.length - MAX_PER_GROUP;
    if (rest > 0) lines.push(`• a ${rest} ${czForm(rest, "další", "další", "dalších")}`);
    parts.push(lines.join("\n"));
  }
  return { subject: `Týdenní přehled absencí · ${period(opts.from, opts.to)}`, body: parts.join("\n\n"), missing };
}
