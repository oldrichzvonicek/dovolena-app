import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/email";
import { carryoverExpiryWarning, weeklyDigestIntro } from "@/lib/czech";
import { computeBalance, dayAfterExpiry, type EntRow, type ReqRow } from "@/lib/balances";
import { approvalSpeed, capacityHeatmap, hrDigest, vacationLiability, type InRequest } from "@/lib/insights";
import { DEFAULT_WORK_DAYS, formatRange } from "@/lib/working-days";
import { hasFeature } from "@/lib/plans";

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
      "id, approval_reminder_hours, digest_last_sent, integration_digest_last, capacity_warning_percent, work_days, email_settings, plan, addons, pending_plan, pending_plan_from, pending_plan_notified, max_carryover_days, carryover_expiry_md"
    );

  // Naplánované změny tarifu: provést ty, kterým nastal den účinnosti (databázová funkce; chyba se ignoruje, dokud není nasazená).
  const applied = await supabase.rpc("apply_scheduled_plan_changes");

  // Upozornit adminy 3 dny předem, že se tarif změní (jednou; e-mail je provozní, nejde vypnout).
  const inThreeDays = iso(addDays(now, 3));
  for (const co of (companies ?? []).filter((x) => x.pending_plan && x.pending_plan_from && !x.pending_plan_notified && x.pending_plan_from <= inThreeDays)) {
    const { data: admins } = await supabase.from("profiles").select("email, name").eq("company_id", co.id).eq("role", "admin").eq("active", true);
    const rows = (admins ?? [])
      .filter((a) => a.email)
      .map((a) => ({
        company_id: co.id,
        category: "billing",
        to_email: a.email as string,
        subject: "Změna tarifu Dodio od " + co.pending_plan_from,
        body: `Dobrý den ${String(a.name).split(" ")[0]},\n\npřipomínáme, že ${co.pending_plan_from} se vaše firma přepne na tarif ${co.pending_plan}, přesně jak jste si naplánovali v Nastavení firmy → Fakturace & tarify. Funkce, co nový tarif nemá, se tím zamknou, ale data zůstanou beze změny. A kdybyste měli víc lidí, než nový tarif dovoluje, nepůjde přidávat další, dokud se počet nesníží. Do tohoto data můžete změnu ještě zrušit.`,
      }));
    if (rows.length > 0) await supabase.from("email_outbox").insert(rows);
    await supabase.from("companies").update({ pending_plan_notified: true }).eq("id", co.id);
  }

  for (const company of companies ?? []) {
    const [{ data: profiles }, { data: depts }, { data: pending }, { data: away }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, role, staff_role, department_id, manager_id, email_notifications, join_pending").eq("company_id", company.id).eq("active", true),
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
      if (targets.length === 0) continue;

      const reason = approverAway ? "schvalovatel je dnes nepřítomen" : `čeká už ${Math.floor(ageHours)} h`;
      // Typ (leave_type.label) je volný text, který firma může přejmenovat — obecně ho nejde skloňovat.
      // Výchozí "Dovolená" má proto vlastní tvar, zbytek je jen nálepka v pomlčkách (viz schema.sql: stejná
      // logika v notify_on_leave_request_insert/notify_on_leave_request_status_change).
      const typePhrase = r.leave_type?.key === "dovolena" ? "o dovolenou" : `— ${r.leave_type?.label ?? "absence"} —`;
      await supabase.from("notifications").insert(
        targets.map((t) => ({
          profile_id: t,
          type: "request_created",
          leave_request_id: r.id,
          title: "Žádost čeká na schválení",
          body: `${p.name} čeká na rozhodnutí o žádosti ${typePhrase} — zaskakujete za schvalovatele (${reason}), tak to prosím vyřiďte.`,
        }))
      );
      await supabase.from("leave_requests").update({ escalated_at: now.toISOString() }).eq("id", r.id);
      escalated++;
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
        .select("start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(id, name, company_id), leave_type:leave_types(label, key, hide_from_colleagues)")
        .eq("status", "approved")
        .lte("start_date", weekEnd)
        .gte("end_date", today);
      type W = { start_date: string; end_date: string; profile: { id: string; name: string; company_id: string } | null; leave_type: { label: string; key: string; hide_from_colleagues: boolean } | null };
      const weekRows = ((week as unknown as W[]) ?? []).filter((w) => w.profile?.company_id === company.id);
      // Seskupené podle typu absence (Dovolená, Home Office, …), ať je hned vidět, čeho je nejvíc — ne jen
      // chronologický výpis. Skupiny seřazené podle počtu lidí sestupně.
      const byType = new Map<string, W[]>();
      for (const w of weekRows) {
        const label = w.leave_type?.hide_from_colleagues ? "Nepřítomen" : (w.leave_type?.label ?? "Absence");
        (byType.get(label) ?? byType.set(label, []).get(label)!).push(w);
      }
      const whoText =
        [...byType.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([label, items]) => `${label}\n\n${items.slice(0, 12).map((w) => `• ${w.profile!.name} — ${formatRange(w.start_date, w.end_date)}`).join("\n")}`)
          .join("\n\n") || "Tento týden nikdo nechybí.";
      const pendingCount = ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id).length;
      // Skloňování (chybí 1 člověk / chybějí 3 lidé / chybí 5 lidí; čeká 1 žádost / čekají 2 žádosti) řeší sdílená funkce,
      // kterou používá i ukázka v Nastavení → E-maily, aby se text e-mailu a jeho náhled nerozešly.
      const introLine = weeklyDigestIntro(weekRows.length, pendingCount);

      // Firma může jednotlivé druhy e-mailů vypnout (Nastavení → E-maily); chybějící hodnota = zapnuto.
      const emailSettings = ((company as { email_settings?: Record<string, boolean> | null }).email_settings ?? {}) as Record<string, boolean>;
      const rows = people
        .filter((p) => emailSettings.weekly_digest !== false && (p.role === "manager" || p.role === "admin") && p.email && p.email_notifications)
        .map((p) => ({
          company_id: company.id,
          category: "weekly_digest",
          to_email: p.email!,
          subject: "Týdenní přehled absencí — Dodio",
          body: `Dobré ráno ${p.name.split(" ")[0]},\n\n${introLine}\n\n${whoText}`,
        }));
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

  return NextResponse.json({ escalated, digestsQueued: digests, carryoverWarnings, planChangesApplied: (applied.data as number | null) ?? 0 });
}
