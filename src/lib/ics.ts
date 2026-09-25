import { addDays, format, parseISO } from "date-fns";

/** Downloads a single all-day event as an .ics file (opens in Google Calendar / Outlook / Apple Calendar). */
export function downloadIcs(summary: string, startISO: string, endISO: string, uid: string) {
  const fmt = (d: Date) => format(d, "yyyyMMdd");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dodio//CS",
    "BEGIN:VEVENT",
    `UID:${uid}@dodio`,
    `DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss")}`,
    `DTSTART;VALUE=DATE:${fmt(parseISO(startISO))}`,
    `DTEND;VALUE=DATE:${fmt(addDays(parseISO(endISO), 1))}`,
    `SUMMARY:${summary.replace(/[,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "absence.ics";
  a.click();
  URL.revokeObjectURL(url);
}
