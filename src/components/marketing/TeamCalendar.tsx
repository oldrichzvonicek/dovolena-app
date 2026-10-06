import { Container } from "./Container";

// 28. 9. – 11. 10. 2026 — two full weeks including weekends, matching how
// the real team calendar actually shows the range (not just working days).
const DAYS = [
  { label: "po", num: "28" },
  { label: "út", num: "29", today: true },
  { label: "st", num: "30" },
  { label: "čt", num: "1", weekStart: true },
  { label: "pá", num: "2" },
  { label: "so", num: "3", weekend: true },
  { label: "ne", num: "4", weekend: true },
  { label: "po", num: "5", weekStart: true },
  { label: "út", num: "6" },
  { label: "st", num: "7" },
  { label: "čt", num: "8" },
  { label: "pá", num: "9" },
  { label: "so", num: "10", weekend: true },
  { label: "ne", num: "11", weekend: true },
];

// Linked legend shown below the calendar — same colors as the tags inside
// the grid above. Nemoc is deliberately gray, same as "Nepřítomen": the
// calendar hides illness from colleagues (see the privacy copy further
// down the page), so showing it in a distinct color here would contradict
// that claim instead of demonstrating it.
const CALENDAR_LINKS = [
  {
    label: "Dovolená",
    swatch: "bg-dodio-teal",
    body: "Zůstatky, plánování a schvalování jedním klikem",
    href: "/evidence-dovolene",
    linkLabel: "evidence dovolené",
  },
  {
    label: "Nemoc",
    swatch: "bg-dodio-border",
    body: "Nemoc a lékař jsou skryté, vidí je jen nadřízený a HR",
    href: "/evidence-absenci",
    linkLabel: "evidence absencí zaměstnanců",
  },
  {
    label: "Home office",
    swatch: "bg-[#4A7FC9]",
    body: "Žádosti o práci z domova s přehledem, kdo je kde",
    href: "/home-office",
    linkLabel: "evidence home office",
  },
  {
    label: "Sick days",
    swatch: "bg-dodio-danger",
    body: "Limit sick days a jejich čerpání na jednom místě",
    href: "/sick-days",
    linkLabel: "evidence sick days",
  },
];

export function TeamCalendar() {
  return (
    <section id="kalendar" className="scroll-mt-16 border-y border-dodio-border bg-dodio-surface-card font-dodio-sans lg:scroll-mt-24">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Týmový kalendář
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Celý tým na jeden pohled.
          </h2>
          <p className="m-0 max-w-[640px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
            Vidíte, kdo chybí, kdo žádá o dovolenou a co čeká na schválení — na jednom místě, hned teď.
          </p>
        </div>

        {/* Filter bar — illustrative, matches the app's real controls */}
        <div aria-hidden="true" className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-dodio-ink-muted">
            <span className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-dodio-teal bg-dodio-teal">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1.5 5l2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Seskupit podle oddělení
          </label>
          <span className="rounded-dodio-md border border-dodio-border bg-dodio-surface px-3.5 py-2 text-sm text-dodio-ink-muted">
            Všechna oddělení
          </span>
          <span className="rounded-dodio-md border border-dodio-border bg-dodio-surface px-3.5 py-2 text-sm text-dodio-ink-muted">
            Všechny absence
          </span>
          <span className="rounded-dodio-md border border-dodio-border bg-dodio-surface px-3.5 py-2 text-sm text-dodio-ink-muted">
            Hledat zaměstnance…
          </span>
          <div className="ml-auto flex items-center gap-2 text-sm text-dodio-ink-muted">
            <span>28. 9. – 11. 10. 2026</span>
            <span className="rounded-dodio-sm border border-dodio-border px-2.5 py-1 text-xs font-semibold">Dnes</span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-dodio-lg border border-dodio-border">
          <div className="grid min-w-[1180px] grid-cols-[190px_repeat(14,minmax(56px,1fr))] grid-rows-[52px_60px_36px_56px_56px_56px_36px_56px_56px] relative bg-dodio-surface-card">
            {/* header row */}
            <div className="col-start-1 flex items-center border-b border-dodio-border bg-[#FAF9F5] px-4 text-[13px] font-semibold text-dodio-ink-muted">
              Jméno
            </div>
            {DAYS.map((day, i) => (
              <div
                key={`${day.label}-${day.num}`}
                style={{ gridColumnStart: i + 2 }}
                className={`row-start-1 flex flex-col items-center justify-center border-b text-[11px] ${
                  day.weekStart ? "border-l-2" : ""
                } border-dodio-border ${
                  day.today ? "bg-[#E3F2EC]" : day.weekend ? "bg-[#F3F0E8]" : "bg-[#FAF9F5]"
                } text-dodio-ink-muted`}
              >
                <span>{day.label}</span>
                <strong className={`text-sm ${day.today ? "text-dodio-teal-dark" : "text-dodio-ink"}`}>{day.num}</strong>
              </div>
            ))}

            {/* pinned "you" row */}
            <div className="col-start-1 row-start-2 flex flex-col justify-center gap-0.5 border-b border-dodio-border bg-[#E3F2EC]/40 px-4">
              <div className="text-sm font-semibold">
                Jana Nováková <span className="font-normal text-dodio-ink-muted">(vy)</span>
              </div>
              <div className="text-xs text-dodio-ink-muted">e-Commerce</div>
            </div>
            <div className="z-[2] col-start-5 col-end-6 row-start-2 mx-1 flex h-8 items-center justify-center self-center rounded-dodio-md bg-dodio-teal text-xs font-semibold text-white">
              Dovolená
            </div>
            <div className="z-[2] col-start-9 col-end-11 row-start-2 mx-1 flex h-8 items-center justify-center self-center rounded-dodio-md bg-dodio-teal text-xs font-semibold text-white">
              Dovolená
            </div>

            {/* Finance group */}
            <div className="col-span-full col-start-1 row-start-3 flex items-center gap-2 border-b border-dodio-border bg-[#FAF9F5] px-4 text-xs font-semibold text-dodio-ink-muted">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 3.5l3 3 3-3" fill="none" stroke="#5F5E5A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Finance (6)
            </div>
            <div className="col-start-1 row-start-4 flex items-center gap-2.5 border-b border-[#EFEDE6] px-4 text-sm">
              <span className="font-medium">Alena Králová</span>
            </div>
            <div className="col-start-1 row-start-5 flex items-center gap-2.5 border-b border-[#EFEDE6] px-4 text-sm">
              <span className="font-medium">Ondřej Veselý</span>
            </div>
            <div className="z-[2] col-start-8 col-end-10 row-start-5 mx-1 flex h-8 items-center justify-center self-center rounded-dodio-md bg-dodio-danger text-xs font-semibold text-white">
              Sick Day
            </div>
            <div className="col-start-1 row-start-6 flex items-center gap-2.5 px-4 text-sm">
              <span className="font-medium">Veronika Sedláková</span>
            </div>
            <div className="z-[2] col-start-10 col-end-11 row-start-6 mx-1 flex h-8 items-center justify-center self-center rounded-dodio-md bg-dodio-border text-xs font-semibold text-dodio-ink-muted">
              Nepřítomen
            </div>

            {/* DPO group */}
            <div className="col-span-full col-start-1 row-start-7 flex items-center gap-2 border-y border-dodio-border bg-[#FAF9F5] px-4 text-xs font-semibold text-dodio-ink-muted">
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 3.5l3 3 3-3" fill="none" stroke="#5F5E5A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Obchod (5)
            </div>
            <div className="col-start-1 row-start-8 flex items-center gap-2.5 border-b border-[#EFEDE6] px-4 text-sm">
              <span className="font-medium">David Kučera</span>
            </div>
            <div className="z-[2] col-start-9 col-end-12 row-start-8 mx-1 flex h-8 items-center justify-center self-center rounded-dodio-md bg-[#4A7FC9] text-xs font-semibold text-white">
              Home Office
            </div>
            <div className="col-start-1 row-start-9 flex items-center gap-2.5 px-4 text-sm">
              <span className="font-medium">Roman Richter</span>
            </div>
            <div className="z-[2] col-start-2 col-end-6 row-start-9 mx-1 flex h-8 items-center self-center rounded-dodio-md bg-dodio-teal px-3 text-xs font-semibold text-white">
              Dovolená
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
            Co v kalendáři uvidíte
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {CALENDAR_LINKS.map((item) => (
              <div key={item.href} className="flex h-full flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-dodio-ink">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.swatch}`} aria-hidden="true" />
                  {item.label}
                </div>
                <p className="m-0 text-[13px] leading-[19px] text-dodio-ink-muted">{item.body}</p>
                <a
                  href={item.href}
                  data-link-location="calendar-legend"
                  className="mt-auto text-[13px] font-medium text-dodio-teal-dark no-underline hover:underline"
                >
                  {item.linkLabel} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
