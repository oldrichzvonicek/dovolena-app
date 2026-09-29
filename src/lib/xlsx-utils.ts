import * as XLSX from "xlsx";

/**
 * Excel exporty dřív nechávaly sloupce na výchozí (úzké) šířce — nadpisy i hodnoty typu "e-Commerce"
 * nebo "Pracovních dní" se pak v Excelu useknuté ("e-Commer", "Pracovních"), dokud si to člověk sám
 * nepřetáhl. Auto-fit podle nejdelšího řetězce v každém sloupci (nadpis i hodnoty) a zapnutý automatický
 * filtr na hlavičce — obojí zvládá i community verze knihovny xlsx, bez potřeby placené edice.
 */
export function autoFitSheet(sheet: XLSX.WorkSheet, headers: string[], rows: (string | number)[][]): XLSX.WorkSheet {
  sheet["!cols"] = headers.map((h, i) => {
    const longest = rows.reduce((max, row) => Math.max(max, String(row[i] ?? "").length), h.length);
    // +2 pro trochu vzduchu okolo textu; strop 60 znaků, ať jeden extrémně dlouhý řádek (např. poznámka) nezvětší sloupec přes celou obrazovku.
    return { wch: Math.min(60, Math.max(8, longest + 2)) };
  });
  if (rows.length > 0) {
    const lastCol = XLSX.utils.encode_col(headers.length - 1);
    sheet["!autofilter"] = { ref: `A1:${lastCol}${rows.length + 1}` };
  }
  return sheet;
}
