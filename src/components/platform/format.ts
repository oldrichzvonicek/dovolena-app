import { planByKey } from "@/lib/plans";

export const formatKc = (n: number) => `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
export const formatDate = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("cs-CZ") : "–");
export const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");

/** „dnes“, „včera“, „před N dny“ — pro poslední aktivitu firmy (indikátor rizika odchodu). Bez data = „bez aktivity“. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "bez aktivity";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "dnes";
  if (days === 1) return "včera";
  if (days < 30) return `před ${days} dny`;
  const months = Math.floor(days / 30);
  return `před ${months} ${months === 1 ? "měsícem" : months < 5 ? "měsíci" : "měsíci"}`;
}
/** Název tarifu tak, jak ho vidí zákazník (klíče basic a starter se v aplikaci jmenují Starter a Team). */
export const planName = (key: string | null | undefined) => planByKey(key).name;

export const COMPANY_STATUS: Record<string, { label: string; className: string }> = {
  active: { label: "Aktivní", className: "bg-teal-light text-teal-dark" },
  suspended: { label: "Pozastavená", className: "bg-warning-light text-warning-dark" },
  pending_deletion: { label: "Ke smazání", className: "bg-danger-light text-danger-dark" },
  deleted: { label: "Smazaná", className: "bg-rust-light text-rust-dark" },
};

export const INVOICE_STATUS: Record<string, { label: string; className: string }> = {
  issued: { label: "Vystavená", className: "bg-sky-light text-sky-dark" },
  paid: { label: "Zaplacená", className: "bg-teal-light text-teal-dark" },
  void: { label: "Storno", className: "bg-rust-light text-rust-dark" },
};
