import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_WORK_DAYS, countWorkingDays } from "@/lib/working-days";

/**
 * Ukázková data: fiktivní oddělení, lidé a absence, aby si administrátor mohl Dodio prohlédnout dřív, než pozve skutečné lidi.
 * Běží jen na serveru (service role): fiktivní lidé jsou skutečné účty bez možnosti přihlášení, označené `is_demo`.
 * Absence se vkládají jako schválené a čekající se pak přepnou zpět — tak nevzniknou žádná oznámení, e-maily ani webhooky.
 * Smazání odstraní všechny účty s `is_demo` (a s nimi jejich žádosti a nároky) a ukázková oddělení.
 */

interface DemoPerson {
  name: string;
  dept: number;
  role: "manager" | "employee";
}

const DEPARTMENTS = ["Obchod (ukázka)", "Marketing (ukázka)", "Provoz (ukázka)"];

const PEOPLE: DemoPerson[] = [
  { name: "Tomáš Horák", dept: 0, role: "manager" },
  { name: "Lucie Kratochvílová", dept: 0, role: "employee" },
  { name: "Martin Beneš", dept: 0, role: "employee" },
  { name: "Petra Jelínková", dept: 0, role: "employee" },
  { name: "Jakub Marek", dept: 0, role: "employee" },
  { name: "Eva Dvořáková", dept: 1, role: "manager" },
  { name: "Ondřej Pospíšil", dept: 1, role: "employee" },
  { name: "Klára Veselá", dept: 1, role: "employee" },
  { name: "David Šimek", dept: 1, role: "employee" },
  { name: "Radek Fiala", dept: 2, role: "manager" },
  { name: "Hana Malá", dept: 2, role: "employee" },
  { name: "Filip Kolář", dept: 2, role: "employee" },
  { name: "Zuzana Bártová", dept: 2, role: "employee" },
  { name: "Lukáš Sedláček", dept: 2, role: "employee" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** Deterministický generátor, aby ukázka vypadala pokaždé podobně. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export interface DemoStatus {
  exists: boolean;
  people: number;
  /** Ukázková data lze přidat jen do prázdné firmy (žádní další lidé, žádosti, pozvánky ani oddělení). */
  eligible: boolean;
}

export async function demoStatus(admin: SupabaseClient, companyId: string): Promise<DemoStatus> {
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const people = await count(admin.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_demo", true));
  if (people > 0) return { exists: true, people, eligible: false };

  const { data: real } = await admin.from("profiles").select("id").eq("company_id", companyId).eq("is_demo", false);
  const realIds = (real ?? []).map((p) => p.id as string);
  const requests = realIds.length > 0 ? await count(admin.from("leave_requests").select("id", { count: "exact", head: true }).in("profile_id", realIds)) : 0;
  const invites = await count(admin.from("company_invites").select("id", { count: "exact", head: true }).eq("company_id", companyId));
  const departments = await count(admin.from("departments").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_demo", false));
  return { exists: false, people: 0, eligible: realIds.length <= 1 && requests === 0 && invites === 0 && departments === 0 };
}

export async function createDemoData(admin: SupabaseClient, companyId: string, today: string): Promise<{ people: number; requests: number }> {
  const status = await demoStatus(admin, companyId);
  if (status.exists) throw new Error("Ukázková data už ve firmě jsou.");
  if (!status.eligible) throw new Error("Ukázková data lze přidat jen do prázdné firmy — tahle už má vlastní lidi, oddělení nebo žádosti.");

  const { data: company } = await admin.from("companies").select("work_days").eq("id", companyId).single();
  const workDays = (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;

  const { data: types } = await admin.from("leave_types").select("id, key").eq("company_id", companyId);
  const typeId = (key: string) => (types ?? []).find((t) => t.key === key)?.id as string | undefined;
  const vacation = typeId("dovolena");
  const home = typeId("home_office");
  const doctor = typeId("lekar");
  const sick = typeId("sick");
  if (!vacation || !home || !doctor || !sick) throw new Error("Firma nemá základní typy absencí (dovolená, home office, lékař, sick day).");

  const runId = Date.now().toString(36);
  const createdUsers: string[] = [];
  try {
    const { data: depts, error: dErr } = await admin
      .from("departments")
      .insert(DEPARTMENTS.map((name) => ({ company_id: companyId, name, is_demo: true })))
      .select("id, name");
    if (dErr) throw dErr;
    const deptId = (i: number) => (depts ?? []).find((d) => d.name === DEPARTMENTS[i])!.id as string;

    // Účty (bez možnosti přihlášení — náhodné heslo se nikam neukládá).
    const ids: string[] = [];
    for (let i = 0; i < PEOPLE.length; i++) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `ukazka-${runId}-${i + 1}@ukazka.dodio.invalid`,
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("Účet se nepodařilo vytvořit.");
      createdUsers.push(data.user.id);
      ids.push(data.user.id);
    }

    const managerOf = (dept: number) => ids[PEOPLE.findIndex((p) => p.dept === dept && p.role === "manager")];
    const profiles = PEOPLE.map((p, i) => ({
      id: ids[i],
      company_id: companyId,
      department_id: deptId(p.dept),
      manager_id: p.role === "manager" ? null : managerOf(p.dept),
      name: p.name,
      role: p.role,
      avatar_initials: initials(p.name),
      email: `ukazka-${runId}-${i + 1}@ukazka.dodio.invalid`,
      email_notifications: false,
      active: true,
      is_demo: true,
    }));
    const { error: pErr } = await admin.from("profiles").upsert(profiles, { onConflict: "id" });
    if (pErr) throw pErr;

    for (let d = 0; d < DEPARTMENTS.length; d++) {
      await admin.from("departments").update({ head_profile_id: managerOf(d) }).eq("id", deptId(d));
    }

    // Nároky na letošní rok.
    const year = Number(today.slice(0, 4));
    const ents = ids.flatMap((id, i) => [
      { profile_id: id, leave_type_id: vacation, year, total_days: i % 3 === 0 ? 25 : 20, opening_used_days: 0 },
      { profile_id: id, leave_type_id: sick, year, total_days: 5, opening_used_days: 0 },
    ]);
    const { error: eErr } = await admin.from("leave_entitlements").upsert(ents, { onConflict: "profile_id,leave_type_id,year" });
    if (eErr) throw eErr;

    // Absence.
    const rand = rng(20260925);
    const busy: Record<number, string[][]> = {};
    const free = (person: number, s: string, e: string) => !(busy[person] ?? []).some(([bs, be]) => s <= be && e >= bs);
    const nextWorkday = (s: string) => {
      let d = s;
      while (countWorkingDays(d, d, workDays) === 0) d = addDays(d, 1);
      return d;
    };
    const spanEnd = (s: string, len: number) => {
      let e = s;
      while (countWorkingDays(s, e, workDays) < len) e = addDays(e, 1);
      return e;
    };

    interface Req {
      person: number;
      type: string;
      start: string;
      end: string;
      days: number;
      half?: boolean;
      pending?: boolean;
    }
    const reqs: Req[] = [];
    const add = (r: Omit<Req, "start" | "end" | "days"> & { start: string; len: number }) => {
      const start = nextWorkday(r.start);
      const end = spanEnd(start, Math.ceil(r.len));
      const days = r.half ? 0.5 : countWorkingDays(start, end, workDays);
      if (!free(r.person, start, end)) return false;
      (busy[r.person] ??= []).push([start, end]);
      reqs.push({ person: r.person, type: r.type, start, end, days, half: r.half, pending: r.pending });
      return true;
    };

    // Kapacitní kolize v Obchodě: tři lidé chtějí volno ve stejném týdnu (ukáže varování na kapacitu).
    let monday = addDays(today, 14);
    while (new Date(`${monday}T12:00:00Z`).getUTCDay() !== 1) monday = addDays(monday, 1);
    add({ person: 1, type: vacation, start: monday, len: 5 });
    add({ person: 2, type: vacation, start: monday, len: 5 });
    add({ person: 3, type: vacation, start: addDays(monday, 1), len: 4, pending: true });

    PEOPLE.forEach((_, i) => {
      // Letošní čerpání v minulosti.
      const back = 15 + Math.floor(rand() * 110);
      const past = addDays(today, -back);
      if (past >= `${year}-01-01`) add({ person: i, type: vacation, start: past, len: 2 + Math.floor(rand() * 4) });
      // Nadcházející dovolená.
      const ahead = 10 + Math.floor(rand() * 100);
      const r = rand();
      if (r < 0.65) add({ person: i, type: vacation, start: addDays(today, ahead), len: 3 + Math.floor(rand() * 6), pending: r < 0.18 });
      // Home office.
      for (let k = 0; k < 3; k++) add({ person: i, type: home, start: addDays(today, Math.floor(rand() * 60) - 20), len: 1 });
      // Lékař a nemoc pro pár lidí.
      if (i % 4 === 1) add({ person: i, type: doctor, start: addDays(today, -Math.floor(rand() * 40) - 3), len: 1, half: true });
      if (i % 5 === 2) add({ person: i, type: sick, start: addDays(today, -Math.floor(rand() * 50) - 5), len: 1 + Math.floor(rand() * 3) });
    });

    const rows = reqs.map((r) => ({
      profile_id: ids[r.person],
      leave_type_id: r.type,
      start_date: r.start,
      end_date: r.end,
      working_days: r.days,
      half_day: !!r.half,
      status: "approved",
      approved_by: PEOPLE[r.person].role === "manager" ? null : managerOf(PEOPLE[r.person].dept),
    }));
    const { data: inserted, error: rErr } = await admin.from("leave_requests").insert(rows).select("id");
    if (rErr) throw rErr;

    // Čekající žádosti: schválené → čekající (tento přechod nevytváří oznámení ani události pro integrace).
    const pendingIds = (inserted ?? []).filter((_, i) => reqs[i].pending).map((r) => r.id as string);
    if (pendingIds.length > 0) {
      const { error: uErr } = await admin.from("leave_requests").update({ status: "pending", approved_by: null }).in("id", pendingIds);
      if (uErr) throw uErr;
    }

    return { people: PEOPLE.length, requests: rows.length };
  } catch (e) {
    // Úklid po neúspěchu: žádné napůl vytvořené ukázkové účty.
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
    await admin.from("departments").delete().eq("company_id", companyId).eq("is_demo", true);
    throw e;
  }
}

export async function removeDemoData(admin: SupabaseClient, companyId: string): Promise<number> {
  const { data: demo } = await admin.from("profiles").select("id").eq("company_id", companyId).eq("is_demo", true);
  let n = 0;
  for (const p of demo ?? []) {
    const { error } = await admin.auth.admin.deleteUser(p.id as string);
    if (!error) n++;
  }
  await admin.from("departments").delete().eq("company_id", companyId).eq("is_demo", true);
  return n;
}
