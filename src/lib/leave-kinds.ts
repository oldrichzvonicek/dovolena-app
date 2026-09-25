/** Types where the person is still working — they never count as "out" for conflicts, team capacity or presence KPIs. */
const WORKING_TYPE_KEYS = new Set(["home_office"]);

export const reducesPresence = (typeKey: string | null | undefined) => !typeKey || !WORKING_TYPE_KEYS.has(typeKey);

/** What colleagues see instead of a private absence type (e.g. sick leave) — see masked_absences() in schema.sql. */
export const ABSENT_TYPE = { key: "absent", label: "Nepřítomen", color: "slate" as const };
