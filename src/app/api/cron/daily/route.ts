import { NextResponse } from "next/server";
import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/email";

export const dynamic = "force-dynamic";

// Dates are computed in Czech time (Vercel runs in UTC — "today" would otherwise be yesterday for a few hours after midnight).
const iso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" });

/**
 * Daily job: (1) escalates pending requests whose approver is away or that waited longer than
 * approval_reminder_hours to the department deputy (or company admins), (2) on Mondays queues a
 * weekly digest e-mail for managers/admins. Both only create rows — sending is done by /api/cron/process.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date();
  const today = iso(now);
  let escalated = 0;
  let digests = 0;

  const { data: companies } = await supabase.from("companies").select("id, approval_reminder_hours, digest_last_sent, integration_digest_last");

  for (const company of companies ?? []) {
    const [{ data: profiles }, { data: depts }, { data: pending }, { data: away }] = await Promise.all([
      supabase.from("profiles").select("id, name, email, role, department_id, manager_id, email_notifications").eq("company_id", company.id).eq("active", true),
      supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", company.id),
      supabase
        .from("leave_requests")
        .select("id, created_at, start_date, end_date, profile:profiles!leave_requests_profile_id_fkey(id, name, manager_id, department_id, company_id), leave_type:leave_types(label)")
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
      leave_type: { label: string } | null;
    };
    for (const r of ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id)) {
      const p = r.profile!;
      const dept = depts?.find((d) => d.id === p.department_id);
      const approverId = p.manager_id ?? dept?.head_profile_id ?? null;
      const ageHours = (now.getTime() - new Date(r.created_at).getTime()) / 3600000;
      const stale = company.approval_reminder_hours != null && ageHours >= Number(company.approval_reminder_hours);
      const approverAway = !!approverId && absentToday.has(approverId);
      if (!stale && !approverAway) continue;

      let targets = [dept?.deputy_head_profile_id].filter((x): x is string => !!x && x !== p.id && x !== approverId && ids.has(x));
      if (targets.length === 0) targets = admins.map((a) => a.id).filter((x) => x !== p.id && x !== approverId);
      if (targets.length === 0) continue;

      const reason = approverAway ? "schvalovatel je dnes nepřítomen" : `čeká už ${Math.floor(ageHours)} h`;
      await supabase.from("notifications").insert(
        targets.map((t) => ({
          profile_id: t,
          type: "request_created",
          leave_request_id: r.id,
          title: "Žádost čeká na schválení",
          body: `${p.name} — ${r.leave_type?.label ?? "absence"} (${reason}). Zastupujete schvalovatele.`,
        }))
      );
      await supabase.from("leave_requests").update({ escalated_at: now.toISOString() }).eq("id", r.id);
      escalated++;
    }

    // 1b) chat digest "who is out today" (Mon–Fri, once per company per day, only if a webhook subscribes)
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // day of week of the Czech date
    if (weekday >= 1 && weekday <= 5 && company.integration_digest_last !== today) {
      const { data: hooks } = await supabase.from("webhook_integrations").select("events").eq("company_id", company.id).eq("active", true);
      if ((hooks ?? []).some((h) => (h.events as string[]).includes("daily_digest"))) {
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
      const lines = weekRows.slice(0, 12).map((w) => `• ${w.profile!.name} — ${w.leave_type?.hide_from_colleagues ? "Nepřítomen" : w.leave_type?.label} (${w.start_date} – ${w.end_date})`);
      const pendingCount = ((pending as unknown as Pending[]) ?? []).filter((x) => x.profile?.company_id === company.id).length;

      const rows = people
        .filter((p) => (p.role === "manager" || p.role === "admin") && p.email && p.email_notifications)
        .map((p) => ({
          to_email: p.email!,
          subject: "Týdenní přehled absencí — Dodio",
          body: `Dobré ráno ${p.name.split(" ")[0]},\n\nzde je přehled na tento týden.\n\nČeká na schválení: ${pendingCount}\nAbsence tento týden: ${weekRows.length}\n\n${lines.join("\n") || "Tento týden nikdo nechybí."}`,
        }));
      if (rows.length > 0) await supabase.from("email_outbox").insert(rows);
      await supabase.from("companies").update({ digest_last_sent: today }).eq("id", company.id);
      digests += rows.length;
    }
  }

  return NextResponse.json({ escalated, digestsQueued: digests });
}
