/**
 * Dvě připomínky firmě, kde se dlouho nikdo nepřihlásil: po 14 dnech „co čeká“, po 30 dnech nabídka pomoci.
 * Po 60 dnech už nepíšeme (firma je spící, další e-maily by byly jen šum). Krok se eviduje s dnem poslední aktivity,
 * takže po návratu firmy a další pauze začíná sekvence znovu a stejné období se nikdy neopakuje.
 */
export type ReengageStep = "reengage_14" | "reengage_30";

const DAY = 86_400_000;

export function reengageKey(step: ReengageStep, activityDay: string): string {
  return `${step}:${activityDay}`;
}

export function planReengagement(lastActivity: string, now: Date, done: Set<string>): { step: ReengageStep; key: string } | null {
  const days = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / DAY);
  const day = lastActivity.slice(0, 10);
  const step: ReengageStep | null = days >= 60 ? null : days >= 30 ? "reengage_30" : days >= 14 ? "reengage_14" : null;
  if (!step) return null;
  const key = reengageKey(step, day);
  return done.has(key) ? null : { step, key };
}

/** „2 žádosti ke schválení“; prázdný řetězec, když nic nečeká. */
export function pendingPhrase(n: number): string {
  if (n <= 0) return "";
  return `${n} ${n === 1 ? "žádost" : n < 5 ? "žádosti" : "žádostí"} ke schválení`;
}
