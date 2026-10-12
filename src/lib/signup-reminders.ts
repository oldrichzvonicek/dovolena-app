// Co s nepotvrzenou registrací udělat: po 24 h připomínka, po 7 dnech poslední, po 30 dnech smazat (bez profilu).
export type SignupAction = "first" | "last" | "delete" | null;

const DAY = 24;

export function signupAction(ageHours: number, sent: { first: boolean; last: boolean }): SignupAction {
  if (ageHours >= 30 * DAY) return "delete";
  if (ageHours >= 7 * DAY) return sent.last ? null : "last";
  if (ageHours >= DAY) return sent.first || sent.last ? null : "first";
  return null;
}
