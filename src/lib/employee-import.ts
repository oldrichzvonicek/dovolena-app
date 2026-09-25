import { parseCsv } from "@/lib/csv";

/**
 * Import zaměstnanců z exportů mzdových a účetních systémů (Excel / CSV).
 * Každý systém pojmenovává sloupce trochu jinak, proto se sloupce rozpoznávají podle klíčových slov a co se nepozná,
 * si administrátor namapuje ručně. Vše tady jsou čisté funkce (bez prohlížeče), aby šly testovat.
 */

export type FieldKey =
  | "name"
  | "firstName"
  | "lastName"
  | "email"
  | "department"
  | "manager"
  | "hireDate"
  | "endDate"
  | "personalNumber"
  | "vacationTotal"
  | "vacationRemaining"
  | "vacationUsed"
  | "carryover"
  | "sickTotal"
  | "sickRemaining";

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Jméno a příjmení (jeden sloupec)",
  firstName: "Jméno",
  lastName: "Příjmení",
  email: "E-mail",
  department: "Oddělení / středisko",
  manager: "Nadřízený",
  hireDate: "Datum nástupu",
  endDate: "Datum ukončení",
  personalNumber: "Osobní číslo",
  vacationTotal: "Dovolená – nárok celkem",
  vacationRemaining: "Dovolená – zbývá",
  vacationUsed: "Dovolená – vyčerpáno",
  carryover: "Dovolená – převod z minulého roku",
  sickTotal: "Sick days – celkem",
  sickRemaining: "Sick days – zbývá",
};

export const FIELD_ORDER: FieldKey[] = [
  "name",
  "firstName",
  "lastName",
  "email",
  "department",
  "manager",
  "hireDate",
  "endDate",
  "personalNumber",
  "vacationTotal",
  "vacationRemaining",
  "vacationUsed",
  "carryover",
  "sickTotal",
  "sickRemaining",
];

export type Mapping = Partial<Record<FieldKey, number>>;

/** Text bez diakritiky, malými písmeny, jen písmena a číslice oddělené mezerou. */
export function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Načtení souboru: kódování a oddělovač
// ---------------------------------------------------------------------------

/** Exporty z českých systémů bývají ve Windows-1250 (nebo UTF-16 z Excelu), ne v UTF-8. */
export function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf).replace(/^﻿/, "");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buf).replace(/^﻿/, "");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(buf);
  }
}

/** Nejčastější oddělovač v prvních řádcích (mimo uvozovky): středník, čárka nebo tabulátor. Titulní řádky bez oddělovače nevadí. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 20);
  const counts: Record<string, number> = { ";": 0, "\t": 0, ",": 0 };
  for (const line of lines) {
    let inQuotes = false;
    for (const c of line) {
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && c in counts) counts[c]++;
    }
  }
  const best = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
  return best[1] > 0 ? best[0] : ";";
}

export function parseTable(text: string): string[][] {
  return parseCsv(text, detectDelimiter(text)).map((r) => r.map((c) => c.trim()));
}

// ---------------------------------------------------------------------------
// Rozpoznání sloupců
// ---------------------------------------------------------------------------

/** Skóre, jak dobře hlavička odpovídá poli (0 = vůbec). */
function scoreHeader(field: FieldKey, h: string): number {
  const has = (re: RegExp) => re.test(h);
  switch (field) {
    case "email": {
      if (!has(/\b(e ?mail|email|mail)\b/)) return 0;
      let s = 10;
      if (has(/pracovni|firemni|work|company/)) s += 5;
      if (has(/soukrom|privat|osobni|home/)) s -= 5;
      return s;
    }
    case "lastName":
      return has(/^(prijmeni|surname|last name|family name)$/) ? 10 : has(/prijmeni/) && !has(/jmeno/) ? 6 : 0;
    case "firstName":
      return has(/^(jmeno|krestni jmeno|krestni|first name|given name)$/) ? 8 : 0;
    case "name":
      if (has(/(jmeno a prijmeni|prijmeni a jmeno|prijmeni jmeno|jmeno prijmeni|cele jmeno|full name)/)) return 12;
      if (has(/^(zamestnanec|pracovnik|osoba|name|jmeno)$/)) return 8;
      return has(/(zamestnanec|pracovnik)/) && !has(/cislo|id\b/) ? 5 : 0;
    case "department":
      return has(/(oddeleni|stredisko|utvar|divize|department|sekce|tym|team)/) ? 9 : 0;
    case "manager":
      return has(/(nadrizen|vedouci|manazer|manager|supervisor|reports to)/) ? 9 : 0;
    case "hireDate":
      return has(/(datum nastupu|nastup|pracovni pomer od|vznik pracovniho|hire date|start date|datum zahajeni)/) ? 9 : 0;
    case "endDate":
      return has(/(datum ukonceni|ukonceni|pracovni pomer do|konec pracovniho|vystup|termination|end date|odchod)/) ? 9 : 0;
    case "personalNumber":
      return has(/(osobni cislo|os cislo|cislo zamestnance|evidencni cislo|personal number|employee id|id zamestnance)/) ? 8 : 0;
    case "vacationTotal":
      if (has(/dovolen/) && has(/(celk|narok|rocni)/) && !has(/(zbyv|zustat|cerp)/)) return 9;
      // Holá hlavička bez slova „dovolená“ (v tabulce jen se zůstatky dovolené je z kontextu jasné, o co jde).
      return has(/^(narok|narok dni|rocni narok|celkovy narok|celkem dni)$/) ? 7 : 0;
    case "vacationRemaining":
      if (has(/dovolen/) && has(/(zbyv|zustat)/)) return 9;
      return has(/^(zbyva|zbyva dni|zbyvajici|zbyvajici dny|zbytek|zustatek|zustatek dni)$/) ? 7 : 0;
    case "vacationUsed":
      if (has(/dovolen/) && has(/cerp/)) return 9;
      return has(/^(vycerpano|vycerpano dni|cerpano|cerpani|vycerpane dny|cerpane dny)$/) ? 7 : 0;
    case "carryover":
      return has(/(prevod|preneseno|preneseny|z minuleho roku|zbytek z minul|carry)/) ? 10 : 0;
    case "sickTotal":
      return has(/(sick|nemoc|marodk)/) && has(/(celk|narok|rocni)/) && !has(/(zbyv|zustat)/) ? 9 : 0;
    case "sickRemaining":
      return has(/(sick|nemoc|marodk)/) && has(/(zbyv|zustat)/) ? 9 : 0;
  }
}

/** Automatické přiřazení sloupců. Sloupec „Jméno“ je křestní jméno jen tehdy, když je vedle něj samostatné „Příjmení“. */
export function detectMapping(headers: string[]): Mapping {
  const norm = headers.map(normalizeHeader);
  const mapping: Mapping = {};
  const used = new Set<number>();
  const hasLast = norm.some((h) => scoreHeader("lastName", h) > 0);

  const pick = (field: FieldKey, score: (h: string) => number) => {
    let best = -1;
    let bestScore = 0;
    norm.forEach((h, i) => {
      if (used.has(i)) return;
      const s = score(h);
      if (s > bestScore) {
        best = i;
        bestScore = s;
      }
    });
    if (best >= 0) {
      mapping[field] = best;
      used.add(best);
    }
  };

  for (const field of FIELD_ORDER) {
    if (field === "name") {
      pick("name", (h) => (hasLast && /^(jmeno|krestni jmeno|krestni)$/.test(h) ? 0 : scoreHeader("name", h)));
    } else if (field === "firstName") {
      if (hasLast) pick("firstName", (h) => scoreHeader("firstName", h));
    } else {
      pick(field, (h) => scoreHeader(field, h));
    }
  }
  // Pokud je jen „Příjmení“ bez křestního jména, berte ho jako celé jméno.
  if (mapping.lastName !== undefined && mapping.firstName === undefined && mapping.name === undefined) {
    mapping.name = mapping.lastName;
    delete mapping.lastName;
  }
  return mapping;
}

/** Hlavička bývá až pod několika řádky s názvem firmy nebo sestavy — vybere se řádek s nejvíc rozpoznanými sloupci. */
export function detectHeaderRow(table: string[][]): number {
  let best = 0;
  let bestCount = -1;
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const m = detectMapping(table[i]);
    const count = Object.keys(m).length + (m.name !== undefined || m.lastName !== undefined ? 3 : 0);
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Hodnoty
// ---------------------------------------------------------------------------

const TITLES = new Set(["ing", "mgr", "bc", "bca", "mga", "mudr", "mvdr", "judr", "phdr", "rndr", "thdr", "paeddr", "doc", "prof", "dr", "phd", "csc", "dis", "mba", "llm"]);

/** Odstraní tituly (Ing., Mgr., Ph.D., MBA …) — v kalendáři stačí „Jan Novák“. */
export function stripTitles(name: string): string {
  return name
    .split(/[\s,]+/)
    .filter((t) => t && !TITLES.has(t.toLowerCase().replace(/\./g, "")))
    .join(" ");
}

/** „Novák Jan“ → „Jan Novák“ (první slovo je příjmení, zbytek křestní jména). */
export function swapLastFirst(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return name;
  return [...parts.slice(1), parts[0]].join(" ");
}

export function parseNumber(v: string | undefined): number | null {
  if (v === undefined) return null;
  const s = v.replace(/\s| /g, "").replace(",", ".");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const isRealDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && y <= 2100 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** 2021-03-01, 1. 3. 2021, 01.03.2021, 2021/3/1 nebo číslo z Excelu (pořadové datum) → yyyy-mm-dd. */
export function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m && isRealDate(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})/);
  if (m && isRealDate(+m[3], +m[2], +m[1])) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    if (serial > 20000 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
  }
  return null;
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const isValidEmail = (e: string) => EMAIL_RE.test(e);

/** První adresa z buňky typu „a@x.cz; b@y.cz“, malými písmeny. */
export function cleanEmail(v: string | undefined): string {
  return (v ?? "").split(/[\s,;]+/).filter(Boolean)[0]?.toLowerCase() ?? "";
}

export type EmailPattern = "jmeno.prijmeni" | "prijmeni";

/** Odhad pracovního e-mailu podle jména, např. „Jan Novák“ → jan.novak@firma.cz. Vždy jen návrh ke kontrole. */
export function guessEmail(name: string, domain: string, pattern: EmailPattern): string {
  const d = domain.trim().replace(/^@/, "").toLowerCase();
  const parts = normalizeHeader(name).split(" ").filter(Boolean);
  if (!d || parts.length === 0) return "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  const local = pattern === "prijmeni" ? last : parts.length > 1 ? `${first}.${last}` : first;
  return `${local}@${d}`;
}

// ---------------------------------------------------------------------------
// Sestavení řádků
// ---------------------------------------------------------------------------

export type Issue = "missing-name" | "missing-email" | "invalid-email" | "duplicate-email" | "already-exists" | "ended";

export interface ImportRow {
  /** Pořadí v souboru (pro klíč a ruční úpravu e-mailu). */
  index: number;
  name: string;
  email: string;
  department: string;
  manager: string;
  hireDate: string | null;
  endDate: string | null;
  personalNumber: string;
  vacationTotal: number;
  vacationUsed: number;
  carryover: number | null;
  sickTotal: number;
  sickUsed: number;
  issues: Issue[];
}

export interface BuildOptions {
  nameOrder: "auto" | "first-last" | "last-first";
  /** Dnešní datum (yyyy-mm-dd): kdo má ukončení pracovního poměru před ním, je označen „odešel“. */
  today: string;
  defaultVacation: number;
  defaultSick: number;
  existingEmails: Set<string>;
  /** Ručně doplněné nebo opravené e-maily podle pořadí řádku. */
  emailOverrides?: Record<number, string>;
  /** Doména pro odhad chybějících e-mailů (prázdné = neodhadovat). */
  guessDomain?: string;
  guessPattern?: EmailPattern;
}

/** Vacation/sick: z trojice (celkem, zbývá, vyčerpáno) vypočte celkem a vyčerpáno; chybějící hodnoty doplní výchozím nárokem. */
export function resolveBalance(total: number | null, remaining: number | null, used: number | null, fallbackTotal: number): { total: number; used: number } {
  if (total !== null) {
    if (used !== null) return { total, used: Math.max(0, used) };
    if (remaining !== null) return { total, used: Math.max(0, total - remaining) };
    return { total, used: 0 };
  }
  if (remaining !== null) {
    const t = Math.max(fallbackTotal, remaining);
    return { total: t, used: Math.max(0, t - remaining) };
  }
  if (used !== null) return { total: Math.max(fallbackTotal, used), used: Math.max(0, used) };
  return { total: fallbackTotal, used: 0 };
}

export function buildRows(table: string[][], headerRow: number, mapping: Mapping, opts: BuildOptions): ImportRow[] {
  const headerNorm = (table[headerRow] ?? []).map(normalizeHeader);
  const nameHeader = mapping.name !== undefined ? headerNorm[mapping.name] ?? "" : "";
  const lastFirst = opts.nameOrder === "last-first" || (opts.nameOrder === "auto" && /^prijmeni/.test(nameHeader));
  const rows: ImportRow[] = [];
  const seen = new Set<string>();

  table.slice(headerRow + 1).forEach((cells, i) => {
    const get = (f: FieldKey) => (mapping[f] !== undefined ? (cells[mapping[f]!] ?? "").trim() : "");
    if (cells.every((c) => c.trim() === "")) return;

    let name: string;
    if (mapping.firstName !== undefined || mapping.lastName !== undefined) name = `${get("firstName")} ${get("lastName")}`.trim();
    else {
      name = stripTitles(get("name"));
      if (lastFirst) name = swapLastFirst(name);
    }
    if (mapping.firstName !== undefined || mapping.lastName !== undefined) name = stripTitles(name);
    name = name.replace(/\s+/g, " ").trim();

    let email = opts.emailOverrides?.[i] !== undefined ? cleanEmail(opts.emailOverrides[i]) : cleanEmail(get("email"));
    if (!email && opts.guessDomain) email = guessEmail(name, opts.guessDomain, opts.guessPattern ?? "jmeno.prijmeni");

    const endDate = parseDate(get("endDate"));
    const vac = resolveBalance(parseNumber(get("vacationTotal")), parseNumber(get("vacationRemaining")), parseNumber(get("vacationUsed")), opts.defaultVacation);
    const sick = resolveBalance(parseNumber(get("sickTotal")), parseNumber(get("sickRemaining")), null, opts.defaultSick);

    const issues: Issue[] = [];
    if (!name) issues.push("missing-name");
    if (!email) issues.push("missing-email");
    else if (!isValidEmail(email)) issues.push("invalid-email");
    else if (seen.has(email)) issues.push("duplicate-email");
    else if (opts.existingEmails.has(email)) issues.push("already-exists");
    if (email) seen.add(email);
    if (endDate && endDate < opts.today) issues.push("ended");

    rows.push({
      index: i,
      name,
      email,
      department: get("department"),
      manager: normalizeManager(stripTitles(get("manager")), lastFirst),
      hireDate: parseDate(get("hireDate")),
      endDate,
      personalNumber: get("personalNumber"),
      vacationTotal: vac.total,
      vacationUsed: vac.used,
      carryover: parseNumber(get("carryover")),
      sickTotal: sick.total,
      sickUsed: sick.used,
      issues,
    });
  });
  return rows;
}

/** Nadřízený zapsaný jako „Novák Jan“ (příjmení první), když je tak celý soubor. */
export function normalizeManager(manager: string, lastFirst: boolean): string {
  return lastFirst ? swapLastFirst(manager) : manager;
}

/** Řádek se importuje, když nemá žádný problém, který ho vyřazuje. „Odešel“ lze vyřadit volitelně. */
export function isImportable(row: ImportRow, skipEnded: boolean): boolean {
  const blocking: Issue[] = ["missing-name", "missing-email", "invalid-email", "duplicate-email", "already-exists"];
  if (row.issues.some((i) => blocking.includes(i))) return false;
  if (skipEnded && row.issues.includes("ended")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Import zůstatků existujících zaměstnanců (přechod z Excelu)
// ---------------------------------------------------------------------------

export interface BalanceRow {
  /** Pořadí řádku v souboru. */
  index: number;
  name: string;
  email: string;
  vacationTotal: number | null;
  vacationRemaining: number | null;
  vacationUsed: number | null;
  carryover: number | null;
  sickTotal: number | null;
  sickRemaining: number | null;
}

export function buildBalanceRows(table: string[][], headerRow: number, mapping: Mapping, nameOrder: "auto" | "first-last" | "last-first"): BalanceRow[] {
  const headerNorm = (table[headerRow] ?? []).map(normalizeHeader);
  const nameHeader = mapping.name !== undefined ? headerNorm[mapping.name] ?? "" : "";
  const lastFirst = nameOrder === "last-first" || (nameOrder === "auto" && /^prijmeni/.test(nameHeader));
  const rows: BalanceRow[] = [];
  table.slice(headerRow + 1).forEach((cells, i) => {
    if (cells.every((c) => c.trim() === "")) return;
    const get = (f: FieldKey) => (mapping[f] !== undefined ? (cells[mapping[f]!] ?? "").trim() : "");
    let name: string;
    if (mapping.firstName !== undefined || mapping.lastName !== undefined) name = stripTitles((get("firstName") + " " + get("lastName")).trim());
    else {
      name = stripTitles(get("name"));
      if (lastFirst) name = swapLastFirst(name);
    }
    rows.push({
      index: i,
      name: name.replace(/\s+/g, " ").trim(),
      email: cleanEmail(get("email")),
      vacationTotal: parseNumber(get("vacationTotal")),
      vacationRemaining: parseNumber(get("vacationRemaining")),
      vacationUsed: parseNumber(get("vacationUsed")),
      carryover: parseNumber(get("carryover")),
      sickTotal: parseNumber(get("sickTotal")),
      sickRemaining: parseNumber(get("sickRemaining")),
    });
  });
  return rows;
}

export interface PersonRef {
  id: string;
  name: string;
  email: string | null;
}

export type MatchKind = "email" | "name" | "none" | "ambiguous";

const nameKey = (n: string) => normalizeHeader(stripTitles(n)).split(" ").filter(Boolean).sort().join(" ");

/** Přiřazení řádku ze souboru ke stávajícímu zaměstnanci: nejdřív podle e-mailu, jinak podle jména (na pořadí jména a diakritice nezáleží). */
export function matchPerson(row: { name: string; email: string }, people: PersonRef[]): { kind: MatchKind; person?: PersonRef } {
  if (row.email) {
    const hit = people.find((p) => (p.email ?? "").toLowerCase() === row.email);
    if (hit) return { kind: "email", person: hit };
  }
  const key = nameKey(row.name);
  if (!key) return { kind: "none" };
  const hits = people.filter((p) => nameKey(p.name) === key);
  if (hits.length === 1) return { kind: "name", person: hits[0] };
  return { kind: hits.length > 1 ? "ambiguous" : "none" };
}
