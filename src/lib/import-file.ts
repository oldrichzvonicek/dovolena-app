import { decodeText, parseTable } from "@/lib/employee-import";

/** Načte soubor s exportem (Excel .xlsx/.xls/.ods nebo CSV/TXT) do tabulky textů. Excel se čte jen první list. */
export const MAX_IMPORT_BYTES = 5_000_000;
export const MAX_IMPORT_ROWS = 5000;

/** Soubor nebo vložená tabulka, které jsou zjevně příliš velké, se odmítnou dřív, než zamrazí prohlížeč. */
export function assertImportSize(rows: number) {
  if (rows > MAX_IMPORT_ROWS + 20) throw new Error(`Tabulka má příliš mnoho řádků (nejvýše ${MAX_IMPORT_ROWS}). Rozdělte ji na víc souborů.`);
}

export async function readImportFile(file: File): Promise<string[][]> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error("Soubor je příliš velký (nejvýše 5 MB).");
  const buf = await file.arrayBuffer();
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", dateNF: "yyyy-mm-dd", blankrows: false });
    assertImportSize(rows.length);
    return rows.map((r) => r.map((c) => String(c ?? "").trim()));
  }
  const table = parseTable(decodeText(buf));
  assertImportSize(table.length);
  return table;
}
