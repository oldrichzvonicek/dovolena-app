/**
 * Zamykání funkcí podle tarifu: na zkušební firmě postupně nastaví tarif Free / Starter / Team / Pro a ověří, že se funkce
 * zamykají a odemykají podle ceníku (src/lib/plans.ts). Vyžaduje běžící aplikaci na localhost:3000 (kvůli kontrole iCal).
 * Spuštění:  npx tsx scripts/plan-gating.ts
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
const out: string[] = [];
const check = (name: string, actual: boolean, expected: boolean) => out.push(`${actual === expected ? "OK  " : "FAIL"} ${name}: ${actual ? "povoleno" : "zamčeno"} (má být ${expected ? "povoleno" : "zamčeno"})`);

type PlanKey = "free" | "basic" | "starter" | "pro";
const PLANS: PlanKey[] = ["free", "basic", "starter", "pro"];
const LABEL: Record<PlanKey, string> = { free: "Free", basic: "Starter", starter: "Team", pro: "Pro" };
const LIMIT: Record<PlanKey, number | null> = { free: 5, basic: 10, starter: 15, pro: null };
const rank = (p: PlanKey) => PLANS.indexOf(p);

async function main() {
  const { data: company } = await sb.from("companies").insert({ name: "ZZ gating (smazat)", plan: "free" }).select().single();
  const cid = company!.id as string;
  const created: string[] = [];
  try {
    await sb.rpc("seed_default_leave_types", { target_company_id: cid });
    const mk = async (key: string, role: "admin" | "employee", extra: Record<string, unknown> = {}) => {
      const email = `zz-gate-${stamp}-${key}@zz.dodio.invalid`;
      const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
      if (error) throw error;
      created.push(data.user.id);
      const { error: pe } = await sb.from("profiles").upsert({ id: data.user.id, company_id: cid, name: `ZZ ${key}`, role, avatar_initials: "ZZ", email, email_notifications: false, ...extra });
      if (pe) throw pe;
      return { id: data.user.id, email };
    };
    const admin = await mk("admin", "admin");
    const emp = await mk("emp", "employee");
    const dept = (await sb.from("departments").insert({ company_id: cid, name: "A" }).select().single()).data!;
    const c: SupabaseClient = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await c.auth.signInWithPassword({ email: admin.email, password: PASSWORD });
    // Něco do historie změn, ať je co číst.
    await sb.from("audit_log").insert({ company_id: cid, action: "test.gating", details: {} });
    const { data: secret } = await sb.from("profile_secrets").select("calendar_token").eq("profile_id", admin.id).single();

    for (const plan of PLANS) {
      const label = `[${LABEL[plan]}]`;
      await sb.from("companies").update({ plan, addons: [], seniority_enabled: false, approval_reminder_hours: null }).eq("id", cid);
      await sb.from("webhook_integrations").delete().eq("company_id", cid);
      await sb.from("profiles").update({ substitute_id: null }).eq("id", emp.id);
      await sb.from("departments").update({ deputy_head_profile_id: null }).eq("id", dept.id);

      // Historie změn (čtení admina)
      const audit = await c.from("audit_log").select("id").eq("company_id", cid).limit(1);
      check(`${label} historie změn`, (audit.data ?? []).length > 0, rank(plan) >= 2);

      // Integrace: chat od Team, webhooky od Pro
      const chat = await c.from("webhook_integrations").insert({ company_id: cid, provider: "slack", name: "t", url: "https://hooks.slack.com/services/T/B/X", events: ["request_created"], active: true }).select("id");
      check(`${label} integrace do chatu`, !chat.error && (chat.data ?? []).length > 0, rank(plan) >= 2);
      const hook = await c.from("webhook_integrations").insert({ company_id: cid, provider: "webhook", name: "w", url: "https://example.com/hook", events: ["request_created"], active: true }).select("id");
      check(`${label} obecný webhook`, !hook.error && (hook.data ?? []).length > 0, rank(plan) >= 3);

      // Eskalace a zástupy (server)
      const sub = await c.from("profiles").update({ substitute_id: admin.id }).eq("id", emp.id).select("id");
      check(`${label} stálý zástup`, !!(sub.data ?? []).length, rank(plan) >= 3);
      const dep = await c.from("departments").update({ deputy_head_profile_id: emp.id }).eq("id", dept.id).select("id");
      check(`${label} zástupce vedoucího oddělení`, !!(dep.data ?? []).length, rank(plan) >= 3);
      const rem = await c.from("companies").update({ approval_reminder_hours: 24 }).eq("id", cid).select("id");
      check(`${label} eskalace po hodinách`, !!(rem.data ?? []).length, rank(plan) >= 3);

      // Nárok podle odpracovaných let
      const sen = await c.from("companies").update({ seniority_enabled: true }).eq("id", cid).select("id");
      check(`${label} zapnutí nároku podle let`, !!(sen.data ?? []).length, rank(plan) >= 2);
      const rpc = await c.rpc("apply_seniority_entitlements", { p_year: new Date().getFullYear() });
      check(`${label} přepočet nároku podle let`, !rpc.error, rank(plan) >= 2);

      // iCal (server)
      const ical = await fetch(`http://localhost:3000/api/ical/${secret!.calendar_token}`);
      check(`${label} iCal odkaz`, ical.status === 200, rank(plan) >= 1);

      // Role Účetní (doplněk) — přiřazení
      const acct = await c.from("profiles").update({ staff_role: "accountant" }).eq("id", emp.id).select("id");
      check(`${label} role Účetní`, !!(acct.data ?? []).length, rank(plan) >= 1);
      await sb.from("profiles").update({ staff_role: null }).eq("id", emp.id);
      // Smart HR Insights / role HR: od Pro, jinak jen s doplňkem
      const hr = await c.from("profiles").update({ staff_role: "hr" }).eq("id", emp.id).select("id");
      check(`${label} role HR (bez doplňku)`, !!(hr.data ?? []).length, rank(plan) >= 3);
      await sb.from("profiles").update({ staff_role: null }).eq("id", emp.id);
      await sb.from("companies").update({ addons: ["hr_insights"] }).eq("id", cid);
      const hr2 = await c.from("profiles").update({ staff_role: "hr" }).eq("id", emp.id).select("id");
      check(`${label} role HR (s doplňkem Smart HR Insights)`, !!(hr2.data ?? []).length, true);
      await sb.from("profiles").update({ staff_role: null }).eq("id", emp.id);
      await sb.from("companies").update({ addons: [] }).eq("id", cid);
    }

    // Limit uživatelů: aktivní lidé + čekající pozvánky + nové adresy z importu
    await sb.from("webhook_integrations").delete().eq("company_id", cid);
    for (const plan of ["free", "basic", "starter"] as PlanKey[]) {
      const limit = LIMIT[plan]!;
      await sb.from("companies").update({ plan }).eq("id", cid);
      await sb.from("company_invites").delete().eq("company_id", cid);
      const active = 2; // admin + emp
      const room = limit - active;
      const rows = (n: number, tag: string) => Array.from({ length: n }, (_, i) => ({ email: `zz-inv-${stamp}-${tag}-${i}@zz.dodio.invalid`, name: `ZZ Host ${i}`, vacation_total: 20, vacation_opening_used: 0, sick_total: 5, sick_opening_used: 0 }));
      const tooMany = await c.rpc("import_employees", { target_company_id: cid, rows: rows(room + 1, "a") });
      check(`[${LABEL[plan]}] import o jednoho víc než limit (${limit})`, !tooMany.error, false);
      const fits = await c.rpc("import_employees", { target_company_id: cid, rows: rows(room, "b") });
      check(`[${LABEL[plan]}] import přesně do limitu (${limit})`, !fits.error, true);
      const more = await c.rpc("import_employees", { target_company_id: cid, rows: rows(1, "c") });
      check(`[${LABEL[plan]}] další pozvánka po naplnění`, !more.error, false);
      await sb.from("company_invites").delete().eq("company_id", cid);
    }
    // Aktivace deaktivovaného člověka nad limit
    {
      await sb.from("companies").update({ plan: "free" }).eq("id", cid);
      const extras: string[] = [];
      for (let i = 0; i < 3; i++) extras.push((await mk(`extra${i}`, "employee")).id); // 2 + 3 = 5 aktivních
      const off = await mk("off", "employee", { active: false });
      const act = await c.from("profiles").update({ active: true }).eq("id", off.id).select("id");
      check("[Free] aktivace šestého člověka", !!(act.data ?? []).length, false);
      check("[Free] důvod odmítnutí je limit tarifu (ne chyba oprávnění)", /limitu/.test(act.error?.message ?? ""), true);
      await sb.from("companies").update({ plan: "pro" }).eq("id", cid);
      const act2 = await c.from("profiles").update({ active: true }).eq("id", off.id).select("id");
      check("[Pro] aktivace šestého člověka (bez limitu)", !!(act2.data ?? []).length, true);
      void extras;
    }

    // Změna tarifu v průběhu zaplaceného období
    {
      const iso = (offset: number) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return d.toLocaleDateString("sv-SE");
      };
      const empC: SupabaseClient = createClient(URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      await empC.auth.signInWithPassword({ email: emp.email, password: PASSWORD });
      const state = async () => (await sb.from("companies").select("plan, pending_plan, pending_plan_from, plan_paid_until").eq("id", cid).single()).data!;

      await sb.from("companies").update({ plan: "pro", billing_period: "yearly", plan_paid_until: iso(100), pending_plan: null, pending_plan_from: null }).eq("id", cid);
      const sch = await c.rpc("schedule_plan_downgrade", { p_plan: "starter" });
      const st1 = await state();
      check("[Změna] snížení se naplánuje na den po posledním zaplaceném dni", !sch.error && st1.pending_plan === "starter" && st1.pending_plan_from === iso(101) && st1.plan === "pro", true);
      const upd = await c.from("companies").update({ pending_plan: "free" }).eq("id", cid).select("id");
      check("[Změna] admin nemůže změnu tarifu nastavit přímo", !!(upd.data ?? []).length, false);
      const pay = await c.from("companies").update({ plan_paid_until: iso(999) }).eq("id", cid).select("id");
      check("[Změna] admin nemůže prodloužit platnost", !!(pay.data ?? []).length, false);
      const same = await c.rpc("schedule_plan_downgrade", { p_plan: "pro" });
      check("[Změna] stejný tarif se neplánuje", !same.error, false);
      const empTry = await empC.rpc("schedule_plan_downgrade", { p_plan: "free" });
      check("[Změna] zaměstnanec nemůže naplánovat změnu", !empTry.error, false);
      const empCancel = await empC.rpc("cancel_plan_change");
      check("[Změna] zaměstnanec nemůže změnu zrušit", !empCancel.error, false);
      const can = await c.rpc("cancel_plan_change");
      const st2 = await state();
      check("[Změna] admin změnu zruší", !can.error && st2.pending_plan === null && st2.pending_plan_from === null, true);

      await sb.from("companies").update({ plan: "basic" }).eq("id", cid);
      const up = await c.rpc("schedule_plan_downgrade", { p_plan: "pro" });
      check("[Změna] zvýšení tarifu se nedá naplánovat (zařizuje provozovatel)", !up.error, false);
      await sb.from("companies").update({ plan: "pro", plan_paid_until: null }).eq("id", cid);
      const noPaid = await c.rpc("schedule_plan_downgrade", { p_plan: "starter" });
      check("[Změna] bez evidované platnosti se snížení neplánuje", !noPaid.error, false);

      // provedení naplánované změny (jen server)
      await sb.from("companies").update({ plan: "pro", pending_plan: "basic", pending_plan_from: iso(-1), plan_paid_until: iso(-2) }).eq("id", cid);
      const denied = await c.rpc("apply_scheduled_plan_changes");
      check("[Změna] přihlášený uživatel nesmí spustit provedení změn", !denied.error, false);
      const applied = await sb.rpc("apply_scheduled_plan_changes");
      const st3 = await state();
      check("[Změna] server provede změnu s účinností v minulosti", !applied.error && st3.plan === "basic" && st3.pending_plan === null && st3.plan_paid_until === null, true);
      await sb.from("companies").update({ plan: "pro", pending_plan: "basic", pending_plan_from: iso(5) }).eq("id", cid);
      await sb.rpc("apply_scheduled_plan_changes");
      const st4 = await state();
      check("[Změna] změna s budoucí účinností se neprovede předčasně", st4.plan === "pro" && st4.pending_plan === "basic", true);
    }
  } finally {
    for (const id of created) await sb.auth.admin.deleteUser(id).catch(() => {});
    await sb.from("webhook_integrations").delete().eq("company_id", cid);
    const { error } = await sb.from("companies").delete().eq("id", cid);
    out.push(`${error ? "FAIL" : "OK  "} zkušební firma smazána${error ? ": " + error.message : ""}`);
  }
  console.log(out.join("\n"));
  const fails = out.filter((l) => l.startsWith("FAIL")).length;
  console.log(`\n${fails === 0 ? "ŽÁDNÁ CHYBA" : fails + " CHYB"} (${out.filter((l) => l.startsWith("OK")).length} kontrol v pořádku)`);
}
main().catch((e) => {
  console.log(out.join("\n"));
  console.error("CRASHED:", e);
  process.exit(1);
});
