import { Container } from "./Container";

const DAYS = [
  { label: "Po", num: "26", holiday: false },
  { label: "Út", num: "27", holiday: false },
  { label: "Svátek", num: "28", holiday: true },
  { label: "Čt", num: "29", holiday: false },
  { label: "Pá", num: "30", holiday: false },
  { label: "Po", num: "2", holiday: false, weekStart: true },
  { label: "Út", num: "3", holiday: false },
  { label: "St", num: "4", holiday: false },
  { label: "Čt", num: "5", holiday: false },
  { label: "Pá", num: "6", holiday: false },
];

const PEOPLE = [
  { initials: "JN", name: "Jana Nováková", bg: "bg-[#E3F2EC]", fg: "text-dodio-teal-dark" },
  { initials: "TD", name: "Tomáš Dvořák", bg: "bg-[#ECEAE3]", fg: "text-dodio-ink" },
  { initials: "PH", name: "Petra Horáková", bg: "bg-[#FDF1DE]", fg: "text-dodio-warning-dark" },
  { initials: "MS", name: "Martin Svoboda", bg: "bg-[#FBE4DA]", fg: "text-dodio-coral-dark" },
  { initials: "LČ", name: "Lucie Černá", bg: "bg-[#E3F2EC]", fg: "text-dodio-teal-dark" },
];

const LEGEND = [
  { label: "Dovolená", swatch: "bg-dodio-teal" },
  { label: "Nemoc", swatch: "bg-dodio-coral" },
  { label: "Home office", swatch: "bg-dodio-border" },
  { label: "Lékař", swatch: "border border-dodio-teal bg-[#E3F2EC]" },
  { label: "Čeká na schválení", swatch: "border border-dashed border-[#B87718] bg-[#FDF1DE]" },
];

export function TeamCalendar() {
  return (
    <section id="kalendar" className="scroll-mt-16 border-y border-dodio-border bg-dodio-surface-card font-dodio-sans lg:scroll-mt-24">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="flex max-w-[640px] flex-col gap-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
              Týmový kalendář
            </div>
            <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
              Celý tým na jeden pohled.
            </h2>
            <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
              Než schválíte další volno, uvidíte, kdo už chybí. Státní svátky jsou vyznačené samy.
            </p>
          </div>
          <div className="flex max-w-[420px] flex-wrap gap-4 text-[13px] text-dodio-ink-muted lg:justify-end">
            {LEGEND.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-3.5 rounded-[3px] ${item.swatch}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-dodio-lg border border-dodio-border">
          <div className="grid min-w-[900px] grid-cols-[180px_repeat(10,minmax(64px,1fr))] grid-rows-[56px_repeat(5,64px)] relative bg-dodio-surface-card">
            {/* holiday column background */}
            <div className="col-start-4 col-end-5 row-start-1 row-end-7 border-x border-dodio-border bg-[#F3F0E8]" />

            {/* header row */}
            <div className="col-start-1 flex items-center border-b border-dodio-border bg-[#FAF9F5] px-5 text-[13px] font-semibold text-dodio-ink-muted">
              Říjen – listopad 2026
            </div>
            {DAYS.map((day, i) => (
              <div
                key={`${day.label}-${day.num}`}
                style={{ gridColumnStart: i + 2 }}
                className={`row-start-1 flex flex-col items-center justify-center border-b text-xs ${
                  day.weekStart ? "border-l-2" : ""
                } ${
                  day.holiday
                    ? "z-[1] border-dodio-border bg-[#FBE4DA] text-dodio-coral-dark"
                    : "border-dodio-border bg-[#FAF9F5] text-dodio-ink-muted"
                }`}
              >
                <span>{day.label}</span>
                <strong className={`text-[15px] ${day.holiday ? "" : "text-dodio-ink"}`}>{day.num}</strong>
              </div>
            ))}

            {/* people rows */}
            {PEOPLE.map((person, i) => (
              <div
                key={person.initials}
                style={{ gridRowStart: i + 2 }}
                className={`col-start-1 flex items-center gap-2.5 px-5 text-[15px] font-medium ${
                  i < PEOPLE.length - 1 ? "border-b border-[#EFEDE6]" : ""
                }`}
              >
                <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-semibold ${person.bg} ${person.fg}`}>
                  {person.initials}
                </span>
                {person.name}
              </div>
            ))}

            {/* absence bars */}
            <div className="z-[2] col-start-7 col-end-12 row-start-2 mx-1.5 flex h-[34px] items-center self-center rounded-dodio-md bg-dodio-teal px-3 text-[13px] font-semibold text-white">
              Dovolená · 5 dní
            </div>
            <div className="z-[2] col-start-3 col-end-4 row-start-3 mx-1.5 flex h-[34px] items-center justify-center self-center rounded-dodio-md bg-dodio-border text-xs font-semibold text-dodio-ink">
              HO
            </div>
            <div className="z-[2] col-start-5 col-end-6 row-start-3 mx-1.5 flex h-[34px] items-center justify-center self-center rounded-dodio-md bg-dodio-border text-xs font-semibold text-dodio-ink">
              HO
            </div>
            <div className="z-[2] col-start-5 col-end-7 row-start-4 mx-1.5 flex h-8 items-center self-center rounded-dodio-md border border-dashed border-[#B87718] bg-[#FDF1DE] px-3 text-[13px] font-semibold text-dodio-warning-dark">
              Čeká · dovolená
            </div>
            <div className="z-[2] col-start-2 col-end-4 row-start-5 mx-1.5 flex h-[34px] items-center self-center rounded-dodio-md bg-dodio-coral px-3 text-[13px] font-semibold text-dodio-coral-dark">
              Nemoc
            </div>
            <div className="z-[2] col-start-7 col-end-8 row-start-6 mx-1.5 flex h-8 items-center justify-center self-center rounded-dodio-md border border-dodio-teal bg-[#E3F2EC] text-xs font-semibold text-dodio-teal-dark">
              Lékař
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
