// Sekvence tipů „Co Dodio umí“ po registraci: pro admina 5 e-mailů za 14 dní, pro zaměstnance 2. Posílá je api/cron/daily.
// Rozhodování je tady jako čisté funkce, ať jde otestovat bez databáze.

/** Jen účty vytvořené od tohoto dne (starší firmy tipy nedostanou). */
export const ONBOARDING_START = "2026-10-15";

export type OnboardingTrack = "admin" | "employee";

export interface OnboardingStep {
  key: string;
  /** Kolik dní po vytvoření účtu se krok posílá. */
  day: number;
  track: OnboardingTrack;
  /** Klíč šablony v katalogu (email-templates.ts). */
  template: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { key: "invite", day: 2, track: "admin", template: "onboarding_invite" },
  { key: "rules", day: 4, track: "admin", template: "onboarding_rules" },
  { key: "approval", day: 7, track: "admin", template: "onboarding_approval" },
  { key: "calendar", day: 10, track: "admin", template: "onboarding_calendar" },
  { key: "export", day: 14, track: "admin", template: "onboarding_export" },
  { key: "emp_start", day: 1, track: "employee", template: "onboarding_employee_1" },
  { key: "emp_plan", day: 7, track: "employee", template: "onboarding_employee_2" },
];

/** Kolik dní po termínu už krok nemá smysl posílat (např. po delším výpadku cronu). */
const STALE_AFTER_DAYS = 5;

/**
 * Co poslat tomuto člověku dnes: nejvýš jeden e-mail na běh (poslední splatný krok); starší splatné kroky se jen
 * zaznamenají jako přeskočené, ať se po výpadku nepošlo několik e-mailů naráz.
 */
export function planOnboarding(ageDays: number, track: OnboardingTrack, done: ReadonlySet<string>): { send: OnboardingStep | null; skip: OnboardingStep[] } {
  const due = ONBOARDING_STEPS.filter((s) => s.track === track && s.day <= ageDays && !done.has(s.key)).sort((a, b) => a.day - b.day);
  if (due.length === 0) return { send: null, skip: [] };
  const last = due[due.length - 1];
  if (ageDays - last.day > STALE_AFTER_DAYS) return { send: null, skip: due };
  return { send: last, skip: due.slice(0, -1) };
}

export interface OnboardingFacts {
  activePeople: number;
  hasBlackout: boolean;
  customVacationDays: boolean;
  hasIntegration: boolean;
}

/** Má smysl krok poslat, nebo to firma už má hotové / není to pro ni relevantní? */
export function shouldSend(step: OnboardingStep, f: OnboardingFacts): boolean {
  switch (step.key) {
    case "invite":
      return f.activePeople < 3;
    case "rules":
      return !f.hasBlackout && !f.customVacationDays;
    case "approval":
      return f.activePeople >= 2;
    case "calendar":
      return f.activePeople >= 3;
    case "export":
      return !f.hasIntegration;
    default:
      return true;
  }
}
