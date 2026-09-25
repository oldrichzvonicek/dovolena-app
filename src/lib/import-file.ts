import { decodeText, parseTable } from "@/lib/employee-import";

/** Načte soubor s exportem (Excel .xlsx/.xls/.ods nebo CSV/TXT) do tabulky textů. Excel se čte jen první list. */
export async function readImportFile(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", dateNF: "yyyy-mm-dd", blankrows: false });
    return rows.map((r) => r.map((c) => String(c ?? "").trim()));
  }
  return parseTable(decodeText(buf));
}
