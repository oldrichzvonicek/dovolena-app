import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, isAuthorizedCron } from "@/lib/email";
import { carryoverExpiryWarning } from "@/lib/czech";
import { buildWeeklyDigest, type DigestRow } from "@/lib/weekly-digest";
import { computeBalance, dayAfterExpiry, type EntRow, type ReqRow } from "@/lib/balances";
import { approvalSpeed, capacityHeatmap, hrDigest, vacationLiability, type InRequest } from "@/lib/insights";
import { DEFAULT_WORK_DAYS, formatRange } from "@/lib/working-days";
import { templateByKey, templateText } from "@/lib/email-templates";
import { ONBOARDING_START, planOnboarding, shouldSend, type OnboardingFacts } from "@/lib/onboarding";
import { signupAction } from "@/lib/signup-reminders";
import { pendingPhrase, planReengagement } from "@/lib/reengagement";
import { hasFeature } from "@/lib/plans";
import { newNpsToken } from "@/lib/nps-token";

export const dynamic = "force-dynamic";

// Dates are computed in Czech time (Vercel runs in UTC — "today" would otherwise be yesterday for a few hours after midnight).
const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });

/**
 * Daily job: (1) escalates pending requests whose approver is away or that waited longer than
 * approval_reminder_hours to the department deputy (or company admins), (2) on Mondays queues a
 * weekly digest e-mail for managers/admins, (3) warns employees 30 and 7 days before their carried-over
 * vacation is about to be forfeited. All only create rows — sending is done by /api/cron/process.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const today = iso(now);
  let escalated = 0;
  let digests = 0;
  let carryoverWarnings = 0;

  const { data: companies } = await supabase
    .from("companies")
    .select(
      "id, status, is_test, last_activity_at, created_at, review_request_sent_at, approval_reminder_hours, digest_last_sent, integration_digest_last, capacity_warning_percent, work_days, email_settings, default_vacation_days, plan, addons, pending_plan, pending_plan_from, pending_plan_notified, max_carryover_days, carryover_expiry_md"
    );

  // Naplánované změny tarifu: provést ty, kterým nastal den účinnosti (databázová funkce; chyba se ignoruje, dokud není nasazená).
  const applied = await supabase.rpc("apply_scheduled_plan_changes");

  // Upozornit adminy 3 dny předem, že se tarif změní (jednou; e-mail je provozní, nejde vypnout).
  const inThreeDays = iso(addDays(now, 3));
  for (const co of (companies ?? []).filter((x) => x.pending_plan && x.pending_plan_from && !x.pending_plan_notified && x.pending_plan_from <= inThreeDays)) {
    const { data: admins } = await supabase.from("profiles").select("email, name").eq("company_id", co.id).eq("role", "admin").eq("active", true);
    const planMail = templateText("plan_change_notice", { plan: String(co.pending_plan), datum: String(co.pending_plan_from) });
    const rows = (admins ?? [])
      .filter((a) => a.email)
      .map((a) => ({
        company_id: co.id,
        category: "billing",
        to_email: a.email as string,
        subject: planMail.subject,
        body: planMail.body,
      }));
    if (rows.length > 0) await supabase.from("email_outbox").insert(rows);
    await supabase.from("companies").update({ pending_plan_notified: true }).eq("id", co.id);
  }

  // Nedokončené registrace: připomínka po 24 h a po 7 dnech, po 30 dnech smazání (jen účet bez profilu). Bez nasazené
  // migrace funkce neexistuje a krok se přeskočí.
  const signups = { reminded: 0, deleted: 0 };
  {
    const { data: unconfirmed } = await supabase.rpc("unconfirmed_signups", { p_older_than: "24 hours" });
    const users = (unconfirmed as { id: string; email: string; created_at: string }[] | null) ?? [];
    if (users.length > 0) {
      const { data: done } = await supabase.from("signup_reminders").select("user_id, first_sent_at, last_sent_at").in("user_id", users.map((u) => u.id));
      const sentBy = new Map((done ?? []).map((r) => [r.user_id as string, r]));
      for (const u of users) {
        const prev = sentBy.get(u.id);
        const action = signupAction((now.getTime() - new Date(u.created_at).getTime()) / 3_600_000, { first: !!prev?.first_sent_at, last: !!prev?.last_sent_at });
        if (action === "delete") {
          const { error } = await supabase.auth.admin.deleteUser(u.id);
          if (!error) {
            await supabase.from("signup_reminders").delete().eq("user_id", u.id);
            signups.deleted++;
          }
        } else if (action) {
          const { data: link } = await supabase.auth.admin.generateLink({ type: "magiclink", email: u.email });
          const url = link?.properties?.action_link;
          if (!url) continue;
          const t = templateText(action === "first" ? "signup_reminder" : "signup_reminder_last", {});
          await supabase.from("email_outbox").insert({ to_email: u.email, subject: t.subject, body: `${t.body}\n\n${url}`, category: "signup_reminder" });
          await supabase.from("signup_reminders").upsert(
            { user_id: u.id, first_sent_at: prev?.first_sent_at ?? now.toISOString(), ...(action === "last" ? { last_sent_at: now.toISOString() } : {}) },
            { onConflict: "user_id" }
          );
          signups.reminded++;
        }
      }
    }
  }

  for (const company of companies ?? []) {
    const [{ data: profiles }, { data: depts }, { data: pending }, { data: away }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, role, staff_role, department_id, manager_id, email_notifications, join_pending, created_at, is_demo, is_external").eq("company_id", company.id).eq("active", true),
      supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", company.id),
      supabase
        .from("leave_requests")
        .select("id, created_at, start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(id, name, manager_id, department_id, company_id), leave_type:leave_types(key, label)")
        .eq("status", "pending")
        .is("escalated_at", null),
      supabase
        .from("leave_requests")
        .select("profile_id, start_date, end_date, leave_type:leave_types(key, counts_as_present)")
        .eq("status", "approved")
        .lte("start_date", today)
        .gte("end_date", today),
    ]);

    const people = profiles ?? [];
    const ids = new Set(people.map((p) => p.id));
    const absentToday = new Set(
      ((away as unknown as { profile_id: string; leave_type: { key: string; counts_as_present: boolean } | null }[]) ?? [])
        .filter((a) => ids.has(a.profile_id) && !a.leave_type?.counts_as_present)
        .map((a) => a.profile_id)
    );
    const admins = people.filter((p) => p.role === "admin");

    // 4) Žádost o hodnocení (NPS) po pozitivním momentu — 30 dní používání NEBO 20 schválených žádostí, cokoli
    // nastane dřív, jen jednou za firmu. Žádný selektivní filtr podle spokojenosti (viz src/app/hodnoceni).
    if (!company.is_test && (company.status ?? "active") === "active" && !company.review_request_sent_at) {
      const ageDays = Math.floor((now.getTime() - new Date(company.created_at).getTime()) / 86_400_000);
      let qualifies = ageDays >= 30;
      if (!qualifies) {
        const { count: approvedCount } = await supabase
          .from("leave_requests")
          .select("id, profile:profiles!leave_requests_profile_id_fkey(company_id)", { count: "exact", head: true })
          .eq("status", "approved")
          .eq("profile.company_id", company.id);
        qualifies = (approvedCount ?? 0) >= 20;
      }
      if (qualifies) {
        const primaryAdmin = admins
          .filter((a) => a.email && a.email_notifications && !a.is_demo && !a.is_external && !a.join_pending)
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
        if (primaryAdmin) {
          const token = newNpsToken(company.id, primaryAdmin.id);
          const t = templateText("nps_request", {});
          await supabase.from("email_outbox").insert({ company_id: company.id, category: "nps", to_email: primaryAdmin.email!, subject: t.subject, body: `${t.body}\n\n@@nps ${appUrl()}/api/nps?token=${encodeURIComponent(token)}` });
        }
        await supabase.from("companies").update({ review_request_sent_at: now.toISOString() }).eq("id", company.id);
      }
    }

    // 1) escalation
    type Pending = {
      id: string;
      created_at: string;
      start_date: string;
      end_date: string;
      profile: { id: string; name: string; manager_id: string | null; department_id: string | null; company_id: string } | null;
      leave_type: { key: string; label: string } | null;
    };
    for (const r of ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id)) {
      const p = r.profile!;
      const dept = depts?.find((d) => d.id === p.department_id);
      const approverId = p.manager_id ?? dept?.head_profile_id ?? null;
      const ageHours = (now.getTime() - new Date(r.created_at).getTime()) / 3600000;
      // Eskalace schvalování je od tarifu Pro.
      if (!hasFeature(company.plan, (company.addons as string[] | null) ?? [], "escalation")) continue;
      const stale = company.approval_reminder_hours != null && ageHours >= Number(company.approval_reminder_hours);
      const approverAway = !!approverId && absentToday.has(approverId);
      if (!stale && !approverAway) continue;

      let targets = [dept?.deputy_head_profile_id].filter((x): x is string => !!x && x !== p.id && x !== approverId && ids.has(x));
      if (targets.length === 0) targets = admins.map((a) => a.id).filter((x) => x !== p.id && x !== approverId);

      // Typ (leave_type.label) je volný text, který firma může přejmenovat — nejde skloňovat, proto je jen v textu jako štítek.
      const typ = r.leave_type?.label ?? "absence";
      const reason = approverAway ? "schvalovatel je dnes nepřítomen" : `žádost čeká už ${Math.floor(ageHours)} h`;
      let notified = false;
      // Schvalovatel, který je přítomen, ale žádost nechává ležet, dostane připomínku sám (s tlačítky Schválit / Zamítnout).
      if (!approverAway && approverId && approverId !== p.id && ids.has(approverId)) {
        const w = templateText("approval_waiting", { zadatel: p.name, typ, hodiny: String(Math.floor(ageHours)) });
        await supabase.from("notifications").insert({ profile_id: approverId, type: "request_created", leave_request_id: r.id, title: w.subject, body: w.body });
        notified = true;
      }
      if (targets.length > 0) {
        const e = templateText("escalation", { zadatel: p.name, typ, duvod: reason });
        await supabase.from("notifications").insert(targets.map((t) => ({ profile_id: t, type: "request_created", leave_request_id: r.id, title: e.subject, body: e.body })));
        notified = true;
      }
      if (!notified) continue;
      await supabase.from("leave_requests").update({ escalated_at: now.toISOString() }).eq("id", r.id);
      escalated++;
    }

    // 1a) připomínka "zítra začíná dovolená" (v pátek i pro víkend a pondělí), jednou na žádost; bez migrace sloupec chybí a dotaz se přeskočí
    {
      const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
      const from = iso(addDays(now, 1));
      const to = iso(addDays(now, dow === 5 ? 3 : 1));
      const { data: starting } = await supabase
        .from("leave_requests")
        .select("id, start_date, end_date, profile_id, leave_type:leave_types(key)")
        .eq("status", "approved")
        .is("start_reminded_at", null)
        .gte("start_date", from)
        .lte("start_date", to)
        .in("profile_id", Array.from(ids));
      const due = ((starting as unknown as { id: string; start_date: string; end_date: string; profile_id: string; leave_type: { key: string } | null }[]) ?? []).filter((x) => x.leave_type?.key === "dovolena");
      if (due.length > 0) {
        await supabase.from("notifications").insert(
          due.map((x) => {
            const t = templateText("leave_starting", { termin: formatRange(x.start_date, x.end_date) });
            return { profile_id: x.profile_id, type: "leave_starting", leave_request_id: x.id, title: t.subject, body: t.body };
          })
        );
        await supabase.from("leave_requests").update({ start_reminded_at: now.toISOString() }).in("id", due.map((x) => x.id));
      }
    }

    // 1a2) tipy „Co Dodio umí“: admin 5 e-mailů za 14 dní, zaměstnanec 2; jen účty od ONBOARDING_START, firma je může vypnout.
    // Bez nasazené migrace (tabulka onboarding_emails) se krok přeskočí.
    if (((company as { email_settings?: Record<string, boolean> | null }).email_settings ?? {}).onboarding_tips !== false) {
      type Person = (typeof people)[number] & { created_at?: string; is_demo?: boolean; is_external?: boolean };
      const candidates = (people as Person[]).filter(
        (p) => p.email && p.email_notifications && !p.join_pending && !p.is_demo && !p.is_external && p.created_at && p.created_at.slice(0, 10) >= ONBOARDING_START
      );
      if (candidates.length > 0) {
        const { data: doneRows, error: doneErr } = await supabase.from("onboarding_emails").select("profile_id, step").in("profile_id", candidates.map((c) => c.id));
        if (!doneErr) {
          const doneBy = new Map<string, Set<string>>();
          for (const r of doneRows ?? []) doneBy.set(r.profile_id as string, (doneBy.get(r.profile_id as string) ?? new Set()).add(r.step as string));
          let facts: OnboardingFacts | null = null;
          for (const p of candidates) {
            const ageDays = Math.floor((now.getTime() - new Date(p.created_at!).getTime()) / 86_400_000);
            const plan = planOnboarding(ageDays, p.role === "admin" ? "admin" : "employee", doneBy.get(p.id) ?? new Set());
            const records: { profile_id: string; step: string; skipped: boolean }[] = plan.skip.map((s) => ({ profile_id: p.id, step: s.key, skipped: true }));
            if (plan.send) {
              if (!facts) {
                const [bl, ig] = await Promise.all([
                  supabase.from("blackout_periods").select("id", { count: "exact", head: true }).eq("company_id", company.id),
                  supabase.from("webhook_integrations").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("active", true),
                ]);
                facts = {
                  activePeople: (people as Person[]).filter((x) => !x.join_pending && !x.is_demo).length,
                  hasBlackout: (bl.count ?? 0) > 0,
                  customVacationDays: Number((company as { default_vacation_days?: number }).default_vacation_days ?? 20) !== 20,
                  hasIntegration: (ig.count ?? 0) > 0,
                };
              }
              if (shouldSend(plan.send, facts)) {
                const tpl = templateByKey(plan.send.template);
                if (tpl) {
                  const t = templateText(tpl.key, {});
                  const cta = tpl.cta ? `\n\n@@cta ${tpl.cta.label} | ${appUrl()}${tpl.cta.path}` : "";
                  await supabase.from("email_outbox").insert({ company_id: company.id, category: "onboarding_tips", to_email: p.email!, subject: t.subject, body: `${t.body}${cta}` });
                  records.push({ profile_id: p.id, step: plan.send.key, skipped: false });
                }
              } else {
                records.push({ profile_id: p.id, step: plan.send.key, skipped: true });
              }
            }
            if (records.length > 0) await supabase.from("onboarding_emails").upsert(records, { onConflict: "profile_id,step" });
          }
        }
      }
    }

    // 1a3) neaktivní firma: po 14 a 30 dnech bez přihlášení a žádostí e-mail adminům (stejný přepínač jako tipy; testovací a pozastavené firmy ne).
    // Bez nasazené migrace (tabulka onboarding_emails) se krok přeskočí.
    {
      const co = company as { email_settings?: Record<string, boolean> | null; status?: string; is_test?: boolean; last_activity_at?: string | null; created_at?: string };
      const base = co.last_activity_at ?? co.created_at;
      const recipients = admins.filter((a) => a.email && a.email_notifications && !a.join_pending && !a.is_demo && !a.is_external);
      if (base && !co.is_test && co.status === "active" && (co.email_settings ?? {}).onboarding_tips !== false && recipients.length > 0) {
        const { data: doneRows, error: doneErr } = await supabase.from("onboarding_emails").select("profile_id, step").in("profile_id", recipients.map((a) => a.id)).like("step", "reengage_%");
        if (!doneErr) {
          const waiting = ((pending as unknown as { profile: { company_id: string } | null }[]) ?? []).filter((r) => r.profile?.company_id === company.id).length;
          // Víc než jeden „nebyznysový“ e-mail denně jednomu člověku nechceme (tipy, hodnocení): připomínka počká na další den.
          const { data: recent } = await supabase.from("email_outbox").select("to_email").eq("company_id", company.id).in("category", ["nps", "onboarding_tips"]).gte("created_at", new Date(now.getTime() - 20 * 3_600_000).toISOString());
          const mailedToday = new Set((recent ?? []).map((r) => (r.to_email as string).toLowerCase()));
          const records: { profile_id: string; step: string; skipped: boolean }[] = [];
          for (const a of recipients) {
            if (mailedToday.has(a.email!.toLowerCase())) continue;
            const done = new Set((doneRows ?? []).filter((r) => r.profile_id === a.id).map((r) => r.step as string));
            const next = planReengagement(base, now, done);
            if (!next) continue;
            const t = templateText(next.step, { cekajici: pendingPhrase(waiting) });
            await supabase.from("email_outbox").insert({ company_id: company.id, category: "onboarding_tips", to_email: a.email!, subject: t.subject, body: `${t.body}\n\n@@cta Otevřít Dodio | ${appUrl()}/dashboard` });
            records.push({ profile_id: a.id, step: next.key, skipped: false });
          }
          if (records.length > 0) await supabase.from("onboarding_emails").upsert(records, { onConflict: "profile_id,step" });
        }
      }
    }

    // 1b) chat digest "who is out today" (Mon–Fri, once per company per day, only if a webhook subscribes)
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // day of week of the Czech date
    if (weekday >= 1 && weekday <= 5 && company.integration_digest_last !== today) {
      const { data: hooksAll } = await supabase.from("webhook_integrations").select("events, provider").eq("company_id", company.id).eq("active", true);
      const addons = (company.addons as string[] | null) ?? [];
      const hooks = (hooksAll ?? []).filter((h) => hasFeature(company.plan, addons, h.provider === "webhook" ? "webhooks" : "chat_integrations"));
      if (hooks.some((h) => (h.events as string[]).includes("daily_digest"))) {
        const { data: outToday } = await supabase
          .from("leave_requests")
          .select("start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(name, company_id), leave_type:leave_types(label, key, hide_from_colleagues, counts_as_present)")
          .eq("status", "approved")
          .lte("start_date", today)
          .gte("end_date", today);
        type O = { profile: { name: string; company_id: string } | null; leave_type: { label: string; key: string; hide_from_colleagues: boolean; counts_as_present: boolean } | null };
        const list = ((outToday as unknown as O[]) ?? []).filter((o) => o.profile?.company_id === company.id && !o.leave_type?.counts_as_present);
        const text = list.length
          ? `🌴 Dnes chybí (${list.length}): ${list.map((o) => `${o.profile!.name} (${o.leave_type?.hide_from_colleagues ? "nepřítomen" : o.leave_type?.label})`).join(", ")}`
          : "✅ Dnes je celý tým přítomen.";
        await supabase.from("integration_outbox").insert({ company_id: company.id, event: "daily_digest", text });
        await supabase.from("companies").update({ integration_digest_last: today }).eq("id", company.id);
      }
    }

    // 2) Monday digest (once per company per day)
    if (new Date(`${today}T12:00:00Z`).getUTCDay() === 1 && company.digest_last_sent !== today) {
      const weekEnd = iso(addDays(now, 6));
      const { data: week } = await supabase
        .from("leave_requests")
        .select("start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(id, name, company_id), leave_type:leave_types(label, key, hide_from_colleagues, counts_as_present)")
        .eq("status", "approved")
        .lte("start_date", weekEnd)
        .gte("end_date", today);
      type W = { start_date: string; end_date: string; profile: { id: string; name: string; company_id: string } | null; leave_type: { label: string; key: string; hide_from_colleagues: boolean; counts_as_present: boolean } | null };
      const weekRows: DigestRow[] = ((week as unknown as W[]) ?? [])
        .filter((w) => w.profile?.company_id === company.id)
        .map((w) => ({
          start_date: w.start_date,
          end_date: w.end_date,
          profileId: w.profile!.id,
          name: w.profile!.name,
          label: w.leave_type?.label ?? "Absence",
          hidden: !!w.leave_type?.hide_from_colleagues,
          present: !!w.leave_type?.counts_as_present,
        }));
      const pendingCount = ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id).length;

      // Firma může jednotlivé druhy e-mailů vypnout (Nastavení → E-maily); chybějící hodnota = zapnuto.
      const emailSettings = ((company as { email_settings?: Record<string, boolean> | null }).email_settings ?? {}) as Record<string, boolean>;
      const rows = people
        .filter((p) => emailSettings.weekly_digest !== false && (p.role === "manager" || p.role === "admin") && p.email && p.email_notifications)
        .map((p) => {
          const d = buildWeeklyDigest({ rows: weekRows, pending: pendingCount, from: today, to: weekEnd });
          return { company_id: company.id, category: "weekly_digest", to_email: p.email!, subject: d.subject, body: d.body };
        });
      if (rows.length > 0) await supabase.from("email_outbox").insert(rows);

      // HR digest (admins and people with the HR role): capacity risks, slow requests — only sent when there is something to act on.
      const hrRecipients = people.filter((p) => emailSettings.hr_digest !== false && (p.role === "admin" || p.staff_role === "hr") && p.email && p.email_notifications);
      if (hrRecipients.length > 0) {
        try {
          const workDays = ((company as { work_days?: number[] }).work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
          const horizonEnd = format(addDays(now, 7 * 6), "yyyy-MM-dd");
          const since90 = format(addDays(now, -90), "yyyy-MM-dd");
          const [{ data: allDepts }, { data: cap }, { data: decisions }] = await Promise.all([
            supabase.from("departments").select("id, name, capacity_warning_percent").eq("company_id", company.id),
            supabase
              .from("leave_requests")
              .select("profile_id, start_date, end_date, working_days, status, leave_type:leave_types(key, counts_against, counts_as_present)")
              .in("status", ["approved", "pending"])
              .gte("end_date", today)
              .lte("start_date", horizonEnd),
            supabase.from("audit_log").select("actor_id, entity_id, action, created_at").eq("company_id", company.id).in("action", ["request.approved", "request.rejected"]).gte("created_at", `${since90}T00:00:00`).limit(1000),
          ]);
          const ids = new Set(people.map((p) => p.id));
          const heat = capacityHeatmap({
            people: people.map((p) => ({ id: p.id, department_id: p.department_id })),
            depts: (allDepts as { id: string; name: string; capacity_warning_percent: number | null }[]) ?? [],
            requests: ((cap as unknown as InRequest[]) ?? []).filter((r) => ids.has(r.profile_id)),
            from: today,
            weeks: 6,
            companyThresholdPct: Number((company as { capacity_warning_percent?: number }).capacity_warning_percent ?? 30),
            workDays,
          });
          const breaches = heat.flatMap((row) => row.weeks.filter((w) => w.breach).map((w) => ({ dept: row.dept, weekStart: w.weekStart, pct: w.peakPct, count: w.peakCount, size: row.size })));

          const decs = (decisions as { actor_id: string | null; entity_id: string; action: string; created_at: string }[]) ?? [];
          const submitted = new Map<string, string>();
          const entityIds = Array.from(new Set(decs.map((d) => d.entity_id)));
          for (let i = 0; i < entityIds.length; i += 200) {
            const { data: created } = await supabase.from("leave_requests").select("id, created_at").in("id", entityIds.slice(i, i + 200));
            for (const c of created ?? []) submitted.set(c.id as string, c.created_at as string);
          }
          const speed = approvalSpeed(decs, submitted, 1);

          const companyPending = ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id);
          const limitHours = company.approval_reminder_hours != null ? Number(company.approval_reminder_hours) : 48;
          const slow = companyPending.filter((x) => (now.getTime() - new Date(x.created_at).getTime()) / 3600000 >= limitHours).length;

          const digest = hrDigest({ capacityBreaches: breaches, liability: vacationLiability([], null, null), slowPending: slow, pendingTotal: companyPending.length, medianDecisionHours: speed.overallMedianHours });
          if (digest) {
            await supabase.from("email_outbox").insert(hrRecipients.map((p) => ({ company_id: company.id, category: "hr_digest", to_email: p.email!, subject: digest.subject, body: digest.body })));
            digests += hrRecipients.length;
          }
        } catch (e) {
          console.error("HR digest failed for company", company.id, e);
        }
      }

      await supabase.from("companies").update({ digest_last_sent: today }).eq("id", company.id);
      digests += rows.length;
    }

    // 3) Carryover expiry warnings — 30 and 7 days before carryover_expiry_md. The exact-day match means this
    // fires at most once per threshold per year, so no extra "already sent" bookkeeping is needed. Inserting
    // into `notifications` gives the in-app bell for free and, via the queue_notification_email trigger
    // (schema.sql), also queues the matching e-mail — respecting both the per-user and per-company opt-outs.
    if (company.carryover_expiry_md) {
      const expiryYear = now.getFullYear();
      const expiryISO = `${expiryYear}-${company.carryover_expiry_md}`;
      const daysUntil = Math.round((new Date(`${expiryISO}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
      const employeeIds = people.filter((p) => !p.join_pending).map((p) => p.id);
      if ((daysUntil === 30 || daysUntil === 7) && employeeIds.length > 0) {
        const [{ data: ents }, { data: reqs }] = await Promise.all([
          supabase
            .from("leave_entitlements")
            .select("profile_id, year, total_days, opening_used_days, leave_type:leave_types(counts_against)")
            .in("profile_id", employeeIds)
            .in("year", [expiryYear - 1, expiryYear]),
          supabase
            .from("leave_requests")
            .select("id, profile_id, start_date, end_date, working_days, leave_type:leave_types(counts_against)")
            .in("profile_id", employeeIds)
            .eq("status", "approved")
            .gte("start_date", `${expiryYear - 1}-01-01`),
        ]);
        const carry = { max: company.max_carryover_days, expiryMD: company.carryover_expiry_md };
        const workDays = ((company as { work_days?: number[] }).work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
        const afterExpiry = dayAfterExpiry(company.carryover_expiry_md);
        const datum = format(new Date(`${expiryISO}T00:00:00Z`), "d. M. yyyy");
        const entRows = (ents as unknown as EntRow[]) ?? [];
        const reqRows = (reqs as unknown as ReqRow[]) ?? [];
        const notifRows = [];
        for (const id of employeeIds) {
          const myEnts = entRows.filter((e) => e.profile_id === id);
          const myReqs = reqRows.filter((r) => r.profile_id === id);
          const before = computeBalance("vacation", myEnts, myReqs, expiryYear, today, carry, workDays);
          const after = computeBalance("vacation", myEnts, myReqs, expiryYear, afterExpiry, carry, workDays);
          const forfeited = Math.max(0, before.carryover - after.carryover);
          if (forfeited > 0) {
            notifRows.push({
              profile_id: id,
              type: "carryover_expiring",
              title: `Převedená dovolená propadne ${datum}`,
              body: carryoverExpiryWarning(forfeited, datum),
            });
          }
        }
        if (notifRows.length > 0) {
          await supabase.from("notifications").insert(notifRows);
          carryoverWarnings += notifRows.length;
        }
      }
    }
  }

  return NextResponse.json({ escalated, digestsQueued: digests, carryoverWarnings, planChangesApplied: (applied.data as number | null) ?? 0, signups });
}
