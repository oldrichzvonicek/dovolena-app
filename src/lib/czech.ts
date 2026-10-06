/**
 * České skloňování podle počtu. Pravidlo: 1 → jednotné číslo, 2–4 → množné (podmět v 1. pádě, sloveso množné),
 * všechno ostatní (0, 5 a víc, tedy i 22 nebo 105) → 2. pád množného čísla a sloveso v jednotném čísle.
 * Příklady: „chybí 1 člověk“, „chybějí 3 lidé“, „chybí 5 lidí“; „čeká 1 žádost“, „čekají 2 žádosti“, „čeká 5 žádostí“.
 */
export function czForm<T>(n: number, one: T, few: T, many: T): T {
  const a = Math.abs(n);
  if (a === 1) return one;
  if (a >= 2 && a <= 4) return few;
  return many;
}

/** „1 člověk“, „3 lidé“, „5 lidí“. */
export const czPeople = (n: number) => `${n} ${czForm(n, "člověk", "lidé", "lidí")}`;

/** „1 žádost“, „2 žádosti“, „5 žádostí“. */
export const czRequests = (n: number) => `${n} ${czForm(n, "žádost", "žádosti", "žádostí")}`;

/** „1 den“, „3 dny“, „5 dní“. */
export const czDays = (n: number) => `${n} ${czForm(n, "den", "dny", "dní")}`;

/**
 * Věta k blížícímu se propadnutí převedené dovolené. Používá ji skutečný e-mail/notifikace (api/cron/daily)
 * i ukázka v Nastavení → E-maily (email-templates.ts), aby se texty nerozešly.
 */
export function carryoverExpiryWarning(days: number, datum: string): string {
  const verb = czForm(days, "propadne", "propadnou", "propadne");
  return `Z loňska vám ještě zbývá ${czDays(days)} dovolené a ${datum} ${verb}. Naplánujte si je radši teď, ať o ně nepřijdete.`;
}

/**
 * Úvodní věta týdenního přehledu pro manažery. Používá ji skutečný e-mail (api/cron/daily) i ukázka v Nastavení →
 * E-maily (email-templates.ts), aby se texty nerozešly. Čekající žádosti se zmiňují jen, když někdo chybí a nějaké čekají.
 */
export function weeklyDigestIntro(missing: number, pending: number): string {
  if (missing === 0) return "tady je váš týdenní přehled — tento týden nikdo nechybí.";
  const absent = `${czForm(missing, "chybí", "chybějí", "chybí")} ${czPeople(missing)}`;
  const waiting = pending > 0 ? ` a ${czForm(pending, "čeká", "čekají", "čeká")} na vás ${czRequests(pending)} ke schválení` : "";
  return `tady je váš týdenní přehled — tento týden ${absent}${waiting}.`;
}
