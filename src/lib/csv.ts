/** Minimal CSV parser: handles quoted fields; without `delimiter` it accepts both "," and ";". */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (delimiter ? c === delimiter : c === "," || c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Keyword-based (not exact-phrase) header matching — real-world exports use
 * varying Czech word order/inflection ("Celková dovolená" vs "Dovolená
 * celkem" vs "Celkem dovolená"), so this checks for the presence of stems
 * rather than requiring one fixed phrasing per column.
 */
function matchHeader(h: string): string | null {
  if (h.includes("jmeno")) return "name";
  if (h.includes("email") || h.includes("mail")) return "email";
  if (h.includes("oddel")) return "department";
  if (h.includes("nadriz") || h.includes("manazer") || h.includes("manager")) return "manager";
  const isSick = h.includes("sick") || h.includes("nemoc");
  const isVacation = h.includes("dovolen");
  const isRemaining = h.includes("zbyv");
  const isTotal = h.includes("celk");
  if (isSick && isRemaining) return "sickRemaining";
  if (isSick && isTotal) return "sickTotal";
  if (isVacation && isRemaining) return "vacationRemaining";
  if (isVacation && isTotal) return "vacationTotal";
  return null;
}

export interface ParsedImportRow {
  name: string;
  department: string;
  manager: string;
  email: string;
  vacationRemaining: number;
  vacationTotal: number;
  sickRemaining: number;
  sickTotal: number;
}

export function parseEmployeeImportCsv(text: string): { rows: ParsedImportRow[]; missingColumns: string[] } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], missingColumns: [] };

  const headerRow = table[0].map(normalizeHeader);
  const columnIndex: Record<string, number> = {};
  headerRow.forEach((h, i) => {
    const key = matchHeader(h);
    if (key) columnIndex[key] = i;
  });

  const required = ["name", "email"];
  const missingColumns = required.filter((k) => !(k in columnIndex));

  const rows: ParsedImportRow[] = table.slice(1).map((cells) => {
    const get = (key: string) => (columnIndex[key] !== undefined ? (cells[columnIndex[key]] ?? "").trim() : "");
    const num = (key: string) => {
      const raw = get(key).replace(",", ".");
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      name: get("name"),
      department: get("department"),
      manager: get("manager"),
      email: get("email").toLowerCase(),
      vacationRemaining: num("vacationRemaining"),
      vacationTotal: num("vacationTotal"),
      sickRemaining: num("sickRemaining"),
      sickTotal: num("sickTotal"),
    };
  });

  return { rows: rows.filter((r) => r.name || r.email), missingColumns };
}

export const IMPORT_CSV_TEMPLATE = [
  "Jméno,Oddělení,Nadřízený,E-mail,Dovolená zbývá,Dovolená celkem,Sick days zbývá,Sick days celkem",
  "Jana Nováková,Marketing,,jana@firma.cz,20,20,5,5",
  "Petr Svoboda,Marketing,Jana Nováková,petr@firma.cz,12.5,20,3,5",
].join("\n");

/**
 * Text written into a spreadsheet/CSV export: values that start with = + - @ (or a tab / carriage return) would be run as a
 * formula when opened in Excel or LibreOffice ("CSV injection"). A leading apostrophe makes the cell plain text.
 */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
