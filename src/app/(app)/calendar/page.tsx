import { Header } from "@/components/layout/Header";
import { TeamCalendar } from "@/components/calendar/TeamCalendar";

export default function CalendarPage() {
  return (
    <div>
      <Header title="Týmový kalendář" subtitle="Přehled absencí napříč týmem pro snadné plánování zastupování" />
      <div className="p-8">
        <TeamCalendar />
      </div>
    </div>
  );
}
