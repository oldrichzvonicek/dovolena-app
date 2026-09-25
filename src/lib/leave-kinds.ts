/** Types where the person is still working — they never count as "out" for conflicts, team capacity or presence KPIs. */
const WORKING_TYPE_KEYS = new Set(["home_office"]);

export const reducesPresence = (typeKey: string | null | undefined) => !typeKey || !WORKING_TYPE_KEYS.has(typeKey);
