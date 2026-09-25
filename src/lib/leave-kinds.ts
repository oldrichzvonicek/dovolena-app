/**
 * Types where the person is still working (Home Office, služební cesta…) — they never count as "out" for conflicts,
 * team capacity or presence KPIs. Which types those are is a setting of each type (leave_types.counts_as_present);
 * the app loads it once after sign-in (setPresenceKeys). Until then Home Office is assumed.
 */
let presenceKeys = new Set<string>(["home_office"]);

export const setPresenceKeys = (keys: string[]) => {
  presenceKeys = new Set(keys);
};

export const reducesPresence = (typeKey: string | null | undefined) => !typeKey || !presenceKeys.has(typeKey);

/** What colleagues see instead of a private absence type (e.g. sick leave) — see masked_absences() in schema.sql. */
export const ABSENT_TYPE = { key: "absent", label: "Nepřítomen", color: "slate" as const };
