import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowRequest, clientIp, tooManyRequests } from "@/lib/rate-limit";

function icsDate(iso: string, offsetDays = 0): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  // RFC5545: lines >75 octets should be folded with a leading space on the continuation.
  if (line.length <= 75) return line;
  let result = "";
  let rest = line;
  while (rest.length > 75) {
    result += rest.slice(0, 75) + "\r\n ";
    rest = rest.slice(75);
  }
  return result + rest;
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

  let query = supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, updated_at, leave_type:leave_types(label, hide_from_colleagues), profile:profiles!leave_requests_profile_id_fkey(id, name, manager_id, department_id)"
    )
    .eq("status", "approved");
  query = scope === "team" ? query.eq("profile.company_id", viewer.company_id) : query.eq("profile_id", viewer.id);

  const { data: requests, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Kalendář se nepodařilo načíst." }, { status: 500 });
  }

  type Req = {
    id: string;
    start_date: string;
    end_date: string;
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
  const rows = ((requests as unknown as Req[]) ?? []).filter((r) => r.profile);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dovolena App//CS",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(scope === "team" ? "Dovolená – tým" : "Dovolená – moje absence")}`,
  ];

  for (const r of rows) {
    const typeLabel = r.leave_type?.hide_from_colleagues && !canSeeType(r.profile!) ? "Nepřítomen" : r.leave_type?.label ?? "Absence";
    const summary = scope === "team" ? `${typeLabel} – ${r.profile!.name}` : typeLabel;
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
