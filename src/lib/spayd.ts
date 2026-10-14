// Česká QR platba (standard SPAYD, https://qr-platba.cz): číslo účtu → IBAN a řetězec, který načtou bankovní aplikace.

/** "8180385003/5500" nebo "19-2000145399/0800 (Banka)" → IBAN (CZkk BBBB PPPP PPAA AAAA AAAA). Null při neplatném čísle. */
export function czIban(account: string): string | null {
  const m = /^\s*(?:(\d{1,6})-)?(\d{2,10})\s*\/\s*(\d{4})/.exec(account);
  if (!m) return null;
  const [, prefix = "", number, bank] = m;
  const bban = `${bank}${prefix.padStart(6, "0")}${number.padStart(10, "0")}`;
  // kontrolní číslice: mod 97 z BBAN + "CZ00" převedeného na číslice (C = 12, Z = 35)
  const digits = `${bban}123500`;
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  const check = String(98 - rem).padStart(2, "0");
  return `CZ${check}${bban}`;
}

export interface SpaydInput {
  iban: string;
  amount: number;
  variableSymbol?: string;
  message?: string;
}

/** SPD*1.0*ACC:…*AM:…*CC:CZK*X-VS:…*MSG:… — znak "*" se ve zprávě nesmí vyskytnout, diakritika se odstraní. */
export function spayd(i: SpaydInput): string {
  const msg = (i.message ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .,:/()+-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  const parts = ["SPD*1.0", `ACC:${i.iban}`, `AM:${i.amount.toFixed(2)}`, "CC:CZK"];
  if (i.variableSymbol) parts.push(`X-VS:${i.variableSymbol.replace(/\D/g, "").slice(0, 10)}`);
  if (msg) parts.push(`MSG:${msg}`);
  return parts.join("*");
}
