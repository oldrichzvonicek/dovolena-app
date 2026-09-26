import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature } from "@/lib/plans";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

function icsDate(iso: string, offsetDays = 0): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

/** RFC 5545: řádek delší než 75 oktetů se zalamuje; počítají se BAJTY v UTF-8 a znak (diakritika) se nikdy nerozdělí. */
function foldLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  let limit = 75; // první řádek 75 oktetů, navazující 74 (úvodní mezera se počítá)
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
      limit = 74;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

// Public (token-authenticated, not session-authenticated) iCal feed of
// approved absences — subscribe from Google Calendar/Outlook. ?scope=team
// includes the whole company instead of just this person.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!(await allowRequest(`ical:${clientIp(req.headers)}`, 120, 60))) return tooManyRequests();
  const scope = req.nextUrl.searchParams.get("scope") === "team" ? "team" : "mine";
  const supabase = createAdminClient();

  // The token lives in profile_secrets (readable only by its owner); resolve it with the service role.
  const { data: secret } = await supabase.from("profile_secrets").select("profile_id").eq("calendar_token", (await params).token).maybeSingle();
  const { data: viewer, error: viewerError } = secret
    ? await supabase.from("profiles").select("id, name, company_id, role, active").eq("id", secret.profile_id).maybeSingle()
    : { data: null, error: null };

  // A deactivated (former) employee's calendar link stops working immediately.
  if (viewerError || !viewer || !viewer.active) {
    return NextResponse.json({ error: "Neplatný odkaz na kalendář." }, { status: 404 });
  }

  // iCal export je od tarifu Starter; po snížení tarifu odkaz přestane fungovat, po návratu zase funguje.
  const { data: co } = await supabase.from("companies").select("plan, addons").eq("id", viewer.company_id).maybeSingle();
  if (!hasFeature(co?.plan, (co?.addons as string[] | null) ?? [], "ical")) {
    return NextResponse.json({ error: "Export kalendáře je od tarifu Starter." }, { status: 403 });
  }

  // Absence starší než rok do kalendáře nepatří (odběratel je nepotřebuje a export by rostl donekonečna).
  const since = new Date(Date.now() - 366 * 86400_000).toISOString().slice(0, 10);
  const requests: unknown[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    let query = supabase
      .from("leave_requests")
      .select(
        "id, start_date, end_date, half_day, updated_at, leave_type:leave_types(label, hide_from_colleagues), profile:profiles!leave_requests_profile_id_fkey(id, name, manager_id, department_id)"
      )
      .eq("status", "approved")
      .gte("end_date", since)
      .order("id")
      .range(from, from + 999);
    query = scope === "team" ? query.eq("profile.company_id", viewer.company_id) : query.eq("profile_id", viewer.id);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Kalendář se nepodařilo načíst." }, { status: 500 });
    requests.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }

  type Req = {
    id: string;
    start_date: string;
    end_date: string;
    half_day: boolean | null;
    updated_at: string;
    leave_type: { label: string; hide_from_colleagues: boolean } | null;
    profile: { id: string; name: string; manager_id: string | null; department_id: string | null } | null;
  };
  // Private absence types (e.g. sick leave) are only shown in full to the person, their superiors and admins.
  const { data: depts } = await supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", viewer.company_id);
  const canSeeType = (p: NonNullable<Req["profile"]>) => {
    if (p.id === viewer.id || viewer.role === "admin" || p.manager_id === viewer.id) return true;
    const d = (depts ?? []).find((x) => x.id === p.department_id);
    return !!d && (d.head_profile_id === viewer.id || d.deputy_head_profile_id === viewer.id);
  };
  const rows = (requests as Req[]).filter((r) => r.profile);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dovolena App//CS",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(scope === "team" ? "Dovolená – tým" : "Dovolená – moje absence")}`,
  ];

  for (const r of rows) {
    const typeLabel = r.leave_type?.hide_from_colleagues && !canSeeType(r.profile!) ? "Nepřítomen" : r.leave_type?.label ?? "Absence";
    const base = scope === "team" ? `${typeLabel} – ${r.profile!.name}` : typeLabel;
    const summary = r.half_day ? `${base} (půl dne)` : base;
    lines.push(
      "BEGIN:VEVENT",
      foldLine(`UID:${r.id}@dovolena-app`),
      `DTSTAMP:${icsDate(r.updated_at.slice(0, 10))}T000000Z`,
      `DTSTART;VALUE=DATE:${icsDate(r.start_date)}`,
      `DTEND;VALUE=DATE:${icsDate(r.end_date, 1)}`,
      foldLine(`SUMMARY:${escapeText(summary)}`),
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="dovolena.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
