import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Technical database/network messages → something an employee can act on. Our own messages (already Czech) pass through. */
const FRIENDLY_ERRORS: [RegExp, string][] = [
  [/row-level security|permission denied|not authorized|insufficient_privilege/i, "Na tuto akci nemáte oprávnění."],
  [/duplicate key|already exists|unique constraint/i, "Takový záznam už existuje."],
  [/foreign key|violates.*constraint.*fkey|is still referenced/i, "Záznam se ještě používá jinde, proto ho nelze smazat."],
  [/null value in column|not-null constraint/i, "Vyplňte prosím všechna povinná pole."],
  [/jwt expired|invalid refresh token|refresh_token_not_found|session.*(expired|missing)/i, "Přihlášení vypršelo. Přihlaste se prosím znovu."],
  [/invalid login credentials/i, "Nesprávný e-mail nebo heslo."],
  [/user already registered|already been registered/i, "Uživatel s tímto e-mailem už existuje."],
  [/email rate limit|rate limit|too many requests|over_email_send_rate_limit/i, "Příliš mnoho pokusů. Zkuste to prosím za chvíli."],
  [/failed to fetch|fetch failed|networkerror|network request failed|load failed/i, "Nepodařilo se spojit se serverem. Zkontrolujte připojení k internetu a zkuste to znovu."],
  [/could not find the function|schema cache|relation .* does not exist|column .* does not exist/i, "Aplikace čeká na aktualizaci databáze. Kontaktujte správce."],
  [/value too long|invalid input syntax|out of range/i, "Zadaná hodnota má neplatný formát."],
];

const TECHNICAL_ERROR = /(PGRST\d*|syntax error|at or near|operator does not exist|does not exist|TypeError|ReferenceError|Cannot read|undefined is not|is not a function|pg_[a-z_]+|SQLSTATE|stack)/i;

/** Supabase/Postgrest errors are plain objects with a `.message`, not `instanceof Error` — check for the property, not the class. */
export function errorMessage(e: unknown): string {
  let raw: string | null = null;
  if (e instanceof Error) raw = e.message;
  else if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") raw = (e as { message: string }).message;
  if (raw === null) return "Neznámá chyba. Zkuste to prosím znovu.";
  const hit = FRIENDLY_ERRORS.find(([re]) => re.test(raw!));
  if (hit) return hit[1];
  // Cokoli dalšího, co vypadá jako vnitřní chyba databáze nebo kódu, se uživateli neukazuje (jen do konzole pro podporu).
  if (TECHNICAL_ERROR.test(raw)) {
    console.error("Technická chyba:", raw);
    return "Něco se nepovedlo. Zkuste to prosím znovu; pokud potíže trvají, kontaktujte správce.";
  }
  return raw;
}

/** Czech number formatting: decimal comma, at most one decimal place (10.5 → "10,5", 12 → "12"). */
export function formatNumber(n: number): string {
  return n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
}
