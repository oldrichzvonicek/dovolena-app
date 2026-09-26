/**
 * Matice oprávnění: na zkušební firmě (po skončení se smaže) vyzkouší, co smí která role číst a měnit, a porovná to
 * s očekávaným pravidlem. Spuštění:  npx tsx scripts/permission-matrix.ts
 * Řádky "OK" odpovídají očekávání, "FAIL" je chyba v oprávněních, "INFO" je nález k posouzení (očekávání nebylo dané).
 */
import fs from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const sb = createClient(URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PASSWORD = "Zz-" + crypto.randomUUID();
const stamp = Date.now();
type Role = "admin" | "hr" | "acct" | "mgr" | "emp1" | "emp2" | "foreign" | "inactive";
const users = {} as Record<Role, { id: string; email: string; client: SupabaseClient }>;
const lines: string[] = [];
const record = (kind: "OK" | "FAIL" | "INFO", text: string) => lines.push(`${kind.padEnd(4)} ${text}`);
const expect = (name: string, actual: boolean, expected: boolean) => record(actual === expected ? "OK" : "FAIL", `${name}: ${actual ? "smí" : "nesmí"} (má ${expected ? "smět" : "nesmět"})`);
const info = (name: string, actual: unknown) => record("INFO", `${name}: ${typeof actual === "string" ? actual : JSON.stringify(actual)}`);

async function main() {
  const { data: company } = await sb.from("companies").insert({ name: "ZZ matrix (smazat)", plan: "pro" }).select().single();
  const { data: other } = await sb.from("companies").insert({ name: "ZZ matrix other (smazat)" }).select().single();
  const cid = company!.id as string;
  const created: string[] = [];
  try {
    await sb.rpc("seed_default_leave_types", { target_company_id: cid });
    const { data: types } = await sb.from("leave_types").select("id, key").eq("company_id", cid);
    const t = (k: string) => types!.find((x) => x.key === k)!.id as string;
    const { data: deptA } = await sb.from("departments").insert({ company_id: cid, name: "A" }).select().single();
    const { data: deptB } = await sb.from("departments").insert({ company_id: cid, name: "B" }).select().single();

    const mk = async (role: Role, cId: string, base: "admin" | "manager" | "employee", extra: Record<string, unknown> = {}) => {
      const email = `zz-mx-${stamp}-${role}@zz.dodio.invalid`;
      const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      created.push(data.user.id);
      const { error: pe } = await sb.from("profiles").upsert({ id: data.user.id, company_id: cId, name: `ZZ ${role}`, role: base, avatar_initials: "ZZ", email, email_notifications: false, ...extra });
      if (pe) throw pe;
      users[role] = { id: data.user.id, email, client: null as unknown as SupabaseClient };
    };
    await mk("admin", cid, "admin", { department_id: deptA!.id });
    await mk("mgr", cid, "manager", { department_id: deptA!.id });
    await mk("emp1", cid, "employee", { department_id: deptA!.id, manager_id: users.mgr.id });
    await mk("emp2", cid, "employee", { department_id: deptB!.id });
    await mk("hr", cid, "employee", { staff_role: "hr", department_id: deptB!.id });
    await mk("acct", cid, "employee", { staff_role: "accountant", department_id: deptB!.id });
    await mk("foreign", other!.id, "admin");
    await mk("inactive", cid, "employee", { active: false, department_id: deptB!.id });
    await sb.from("departments").update({ head_profile_id: users.mgr.id }).eq("id", deptA!.id);
    for (const r of Object.keys(users) as Role[]) {
      const c = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await c.auth.signInWithPassword({ email: users[r].email, password: PASSWORD });
      if (error) throw error;
      users[r].client = c;
    }
    const day = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);
      return d.toLocaleDateString("sv-SE");
    };
    const mkReq = async (who: Role, type: string, start: string, status: string) => {
      const { data, error } = await sb.from("leave_requests").insert({ profile_id: users[who].id, leave_type_id: type, start_date: start, end_date: start, working_days: 1, status }).select("id").single();
      if (error) throw error;
      return data.id as string;
    };
    const sick1 = await mkReq("emp1", t("sick"), day(10), "approved");
    const sick2 = await mkReq("emp2", t("sick"), day(12), "approved");
    const vac1 = await mkReq("emp1", t("dovolena"), day(20), "approved");
    const pend1 = await mkReq("emp1", t("dovolena"), day(30), "pending");
    const pend2 = await mkReq("emp2", t("dovolena"), day(32), "pending");
    const pend3 = await mkReq("emp1", t("dovolena"), day(34), "pending");
    const pend4 = await mkReq("emp1", t("dovolena"), day(36), "pending");
    for (const r of ["emp1", "emp2"] as Role[]) {
      await sb.from("leave_entitlements").upsert({ profile_id: users[r].id, leave_type_id: t("dovolena"), year: new Date().getFullYear(), total_days: 20 }, { onConflict: "profile_id,leave_type_id,year" });
    }
    await sb.from("company_billing").upsert({ company_id: cid, billing_email: "faktury@zz.invalid" }, { onConflict: "company_id" });
    await sb.from("profile_hr").upsert({ profile_id: users.emp1.id, hire_date: "2020-01-01", personal_number: "77" });

    const roles: Role[] = ["admin", "hr", "acct", "mgr", "emp1", "emp2", "foreign", "inactive"];
    const seesRow = async (r: Role, table: string, col: string, val: string) => {
      const { data } = await users[r].client.from(table).select(col).eq(col, val);
      return (data ?? []).length > 0;
    };

    // ---------------- ČTENÍ ----------------
    record("INFO", "── ČTENÍ ──");
    // Absence typu nemoc (soukromá): vidí jen dotčený, jeho nadřízený, admin, HR a účetní.
    const sickExpect: Record<Role, [boolean, boolean]> = {
      // [nemoc emp1, nemoc emp2]
      admin: [true, true],
      hr: [true, true],
      acct: [true, true],
      mgr: [true, false], // emp1 je jeho podřízený, emp2 ne
      emp1: [true, false],
      emp2: [false, true],
      foreign: [false, false],
      inactive: [false, false],
    };
    for (const r of roles) {
      expect(`${r} vidí nemoc emp1`, await seesRow(r, "leave_requests", "id", sick1), sickExpect[r][0]);
      expect(`${r} vidí nemoc emp2`, await seesRow(r, "leave_requests", "id", sick2), sickExpect[r][1]);
    }
    for (const r of roles) expect(`${r} vidí dovolenou emp1`, await seesRow(r, "leave_requests", "id", vac1), r !== "foreign" && r !== "inactive");
    // Zůstatky (nárok): vlastní, admin, HR; ostatní?
    for (const r of roles) {
      const a = await seesRow(r, "leave_entitlements", "profile_id", users.emp1.id);
      const b = await seesRow(r, "leave_entitlements", "profile_id", users.emp2.id);
      info(`${r} čte nároky emp1 / emp2`, `${a} / ${b}`);
    }
    // Fakturace: jen admin
    for (const r of roles) expect(`${r} čte fakturační údaje`, await seesRow(r, "company_billing", "company_id", cid), r === "admin");
    // HR údaje (nástup, osobní číslo): dotčený, HR, admin, účetní
    for (const r of roles) expect(`${r} čte HR údaje emp1`, await seesRow(r, "profile_hr", "profile_id", users.emp1.id), ["admin", "hr", "acct", "emp1"].includes(r));
    // Historie změn
    for (const r of roles) {
      const { data } = await users[r].client.from("audit_log").select("id").eq("company_id", cid).limit(1);
      info(`${r} čte historii změn`, (data ?? []).length > 0);
    }
    // Fronta e-mailů a tajné klíče kalendáře: nikdo cizí
    for (const r of roles) {
      const { data } = await users[r].client.from("email_outbox").select("id").limit(1);
      expect(`${r} čte frontu e-mailů`, (data ?? []).length > 0, false);
      const { data: sec } = await users[r].client.from("profile_secrets").select("profile_id");
      const foreignSecrets = (sec ?? []).filter((x) => x.profile_id !== users[r].id).length;
      expect(`${r} čte cizí tajný token kalendáře`, foreignSecrets > 0, false);
    }
    // Pozvánky a integrace
    for (const r of roles) {
      const inv = await users[r].client.from("company_invites").select("id").limit(1);
      info(`${r} čte pozvánky`, !inv.error && (inv.data ?? []).length >= 0 ? "dotaz prošel" : "chyba");
    }
    for (const r of roles) {
      const { data } = await users[r].client.from("webhook_integrations").select("id").eq("company_id", cid).limit(1);
      info(`${r} čte webhooky (řádků)`, (data ?? []).length);
    }

    // ---------------- ZÁPIS ----------------
    record("INFO", "── ZÁPIS ──");
    for (const r of roles) {
      const { data } = await users[r].client.from("companies").update({ name: `ZZ matrix ${r}` }).eq("id", cid).select("id");
      expect(`${r} mění nastavení firmy`, (data ?? []).length > 0, r === "admin");
    }
    for (const r of roles) {
      const { data } = await users[r].client.from("leave_types").update({ label: "Dovolená" }).eq("id", t("dovolena")).select("id");
      expect(`${r} mění typ absence`, (data ?? []).length > 0, r === "admin");
    }
    for (const r of roles) {
      const { data, error } = await users[r].client.from("departments").insert({ company_id: cid, name: `D-${r}` }).select("id");
      const ok = !error && (data ?? []).length > 0;
      info(`${r} zakládá oddělení`, ok);
      if (ok) await sb.from("departments").delete().eq("id", data![0].id);
    }
    // Změna citlivých polí profilu (povýšení sebe, přesun lidí)
    for (const r of roles.filter((x) => x !== "foreign" && x !== "admin")) {
      const { error } = await users[r].client.from("profiles").update({ role: "admin" }).eq("id", users[r].id);
      const { data: check } = await sb.from("profiles").select("role").eq("id", users[r].id).single();
      expect(`${r} si nastaví roli admin`, check?.role === "admin" && !error, false);
    }
    // Deaktivovaný uživatel (odešel z firmy): nesmí měnit nic, ani sám sebe.
    {
      const c = users.inactive.client;
      await c.from("profiles").update({ role: "admin" }).eq("id", users.inactive.id);
      await c.from("profiles").update({ department_id: deptA!.id, manager_id: users.mgr.id }).eq("id", users.inactive.id);
      const { data: after } = await sb.from("profiles").select("role, department_id, manager_id, active").eq("id", users.inactive.id).single();
      expect("deaktivovaný si nastaví roli admin", after?.role === "admin", false);
      expect("deaktivovaný si změní oddělení/nadřízeného", after?.department_id === deptA!.id || after?.manager_id === users.mgr.id, false);
      expect("deaktivovaný se sám znovu aktivuje", after?.active === true, false);
      const { data: seen } = await c.from("leave_requests").select("id").eq("id", vac1);
      expect("deaktivovaný čte absence firmy", (seen ?? []).length > 0, false);
    }
    for (const r of roles) {
      const { data } = await users[r].client.from("profiles").update({ department_id: deptB!.id }).eq("id", users.emp1.id).select("id");
      info(`${r} přesouvá emp1 do oddělení B`, (data ?? []).length > 0);
      await sb.from("profiles").update({ department_id: deptA!.id, manager_id: users.mgr.id }).eq("id", users.emp1.id);
    }
    // Schvalování
    const pendingOf: Record<string, string> = { admin: pend1, hr: pend3, acct: pend4, mgr: pend1, emp1: pend2, emp2: pend2, foreign: pend3 };
    for (const r of roles) {
      const target = r === "mgr" ? pend1 : r === "admin" ? pend2 : pendingOf[r];
      const { data } = await users[r].client.from("leave_requests").update({ status: "approved", approved_by: users[r].id }).eq("id", target).select("id");
      const shouldSucceed = r === "admin" || r === "mgr";
      expect(`${r} schválí čekající žádost`, (data ?? []).length > 0, shouldSucceed);
      if ((data ?? []).length > 0) await sb.from("leave_requests").update({ status: "pending", approved_by: null }).eq("id", target);
    }
    // Manažer proti žádosti cizího oddělení (emp2) a naopak
    {
      const { data } = await users.mgr.client.from("leave_requests").update({ status: "approved", approved_by: users.mgr.id }).eq("id", pend2).select("id");
      expect(`mgr schválí žádost člověka mimo svůj tým`, (data ?? []).length > 0, false);
      const own = await users.emp1.client.from("leave_requests").update({ status: "approved", approved_by: users.emp1.id }).eq("id", pend3).select("id");
      expect(`emp1 schválí sám sobě`, (own.data ?? []).length > 0, false);
    }
    // Mazání cizí žádosti
    for (const r of roles) {
      const { data } = await users[r].client.from("leave_requests").delete().eq("id", pend4).select("id");
      const deleted = (data ?? []).length > 0;
      info(`${r} maže cizí čekající žádost (emp1)`, deleted);
      if (deleted) pend4 && (await sb.from("leave_requests").insert({ id: pend4, profile_id: users.emp1.id, leave_type_id: t("dovolena"), start_date: day(36), end_date: day(36), working_days: 1, status: "pending" }));
    }
    // Zadání absence za jiného (Můj tým → Zadat absenci za zaměstnance)
    for (const r of roles.filter((x) => x !== "foreign" && x !== "inactive")) {
      const d = day(60 + roles.indexOf(r) * 3);
      const { data } = await users[r].client.from("leave_requests").insert({ profile_id: users.emp1.id, leave_type_id: t("dovolena"), start_date: d, end_date: d, working_days: 1, status: "approved" }).select("id");
      info(`${r} zadá schválenou absenci za emp1`, (data ?? []).length > 0);
      if ((data ?? []).length > 0) await sb.from("leave_requests").delete().eq("id", data![0].id);
    }
    const dOther = day(80);
    {
      const { data } = await users.mgr.client.from("leave_requests").insert({ profile_id: users.emp2.id, leave_type_id: t("dovolena"), start_date: dOther, end_date: dOther, working_days: 1, status: "approved" }).select("id");
      expect("mgr zadá absenci za člověka mimo svůj tým", (data ?? []).length > 0, false);
      if ((data ?? []).length > 0) await sb.from("leave_requests").delete().eq("id", data![0].id);
    }
    // Deaktivace zaměstnance
    for (const r of roles.filter((x) => x !== "foreign" && x !== "inactive")) {
      const { data } = await users[r].client.from("profiles").update({ active: false }).eq("id", users.emp2.id).select("id");
      info(`${r} deaktivuje emp2`, (data ?? []).length > 0);
      await sb.from("profiles").update({ active: true, deactivated_at: null }).eq("id", users.emp2.id);
    }
    // Překryv absencí: nikdo nemá dvě nepřítomnosti ve stejný den (ani zadáním za něj), výjimky půldny a práce
    {
      const base = day(100);
      const next = (() => {
        const d = new Date(`${base}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
      })();
      const ins = async (who: Role, profile: Role, type: string, start: string, end: string, half = false) =>
        users[who].client.from("leave_requests").insert({ profile_id: users[profile].id, leave_type_id: type, start_date: start, end_date: end, working_days: half ? 0.5 : 1, half_day: half, status: "pending" }).select("id");
      const first = await ins("emp2", "emp2", t("dovolena"), base, next);
      expect("emp2 zadá první dovolenou", !first.error, true);
      const dup = await ins("emp2", "emp2", t("dovolena"), base, base);
      expect("emp2 zadá dovolenou přes už zapsanou", !dup.error, false);
      const bookDup = await ins("admin", "emp2", t("dovolena"), base, base);
      expect("admin zadá emp2 absenci přes už zapsanou", !bookDup.error, false);
      const ho = await ins("emp2", "emp2", t("home_office"), base, base);
      expect("emp2 zadá Home Office přes dovolenou (práce)", !ho.error, true);
      const halfA = await ins("emp1", "emp1", t("lekar"), base, base, true);
      const halfB = await ins("emp1", "emp1", t("lekar"), base, base, true);
      expect("emp1 zadá dva půldny v jednom dni", !halfA.error && !halfB.error, true);
      const full = await ins("emp1", "emp1", t("dovolena"), base, base);
      expect("emp1 zadá celý den přes půlden", !full.error, false);
      // celozávodní dovolená přeskočí lidi s absencí a neaktivní
      const before = await sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("leave_type_id", t("dovolena")).eq("start_date", base).eq("end_date", base);
      const cw = await users.admin.client.rpc("create_company_wide_leave", { target_company_id: cid, target_leave_type_id: t("dovolena"), p_start_date: base, p_end_date: base, p_working_days: 1, p_note: "test" });
      const { data: got } = await sb.from("leave_requests").select("profile_id").eq("leave_type_id", t("dovolena")).eq("start_date", base).eq("end_date", base);
      const gotIds = new Set((got ?? []).map((r) => r.profile_id));
      expect("celozávodní dovolená proběhla", !cw.error, true);
      expect("celozávodní dovolená přeskočila emp2 (už má dovolenou)", gotIds.size - (before.count ?? 0) >= 0 && (got ?? []).filter((r) => r.profile_id === users.emp2.id).length === 0, true);
      expect("celozávodní dovolená přeskočila deaktivovaného", gotIds.has(users.inactive.id), false);
      expect("celozávodní dovolená zapsala člověku bez absence (mgr)", gotIds.has(users.mgr.id), true);
      await sb.from("leave_requests").delete().eq("start_date", base).in("profile_id", [users.emp1.id, users.emp2.id, users.mgr.id, users.hr.id, users.acct.id, users.admin.id]);
    }
    // RPC
    const rpcRoles: [string, string, Record<string, unknown>, Role[]][] = [
      ["import_employees", "import zaměstnanců", { target_company_id: cid, rows: [] }, ["admin", "hr"]],
      ["import_balances", "import zůstatků", { target_company_id: cid, rows: [] }, ["admin", "hr"]],
      ["set_email_setting", "přepínač e-mailů 'reminders'", { p_key: "reminders", p_enabled: true }, ["admin", "hr"]],
      ["email_log", "přehled odeslaných e-mailů", { p_limit: 1 }, ["admin"]],
    ];
    for (const [fn, label, args, allowed] of rpcRoles) {
      for (const r of roles.filter((x) => x !== "foreign")) {
        const { error } = await users[r].client.rpc(fn, args);
        expect(`${r} volá ${label}`, !error, allowed.includes(r));
      }
    }
    for (const r of roles) {
      const { error } = await users[r].client.rpc("send_vacation_reminders", { target_profile_ids: [users.emp1.id] });
      info(`${r} posílá připomínky nevyčerpané dovolené`, !error);
    }
  } finally {
    for (const id of created) await sb.auth.admin.deleteUser(id).catch(() => {});
    for (const c of [cid, other!.id]) await sb.from("companies").delete().eq("id", c);
  }
  console.log(lines.join("\n"));
  const fails = lines.filter((l) => l.startsWith("FAIL")).length;
  console.log(`\n${fails === 0 ? "ŽÁDNÁ CHYBA" : fails + " CHYB"} (${lines.filter((l) => l.startsWith("OK")).length} kontrol v pořádku)`);
}
main().catch((e) => {
  console.log(lines.join("\n"));
  console.error("CRASHED:", e);
  process.exit(1);
});
