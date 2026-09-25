import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Supabase/Postgrest errors are plain objects with a `.message`, not `instanceof Error` — check for the property, not the class. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Neznámá chyba.";
}

/** Czech number formatting: decimal comma, at most one decimal place (10.5 → "10,5", 12 → "12"). */
export function formatNumber(n: number): string {
  return n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
}
