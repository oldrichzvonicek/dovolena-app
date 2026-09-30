import { Container } from "./Container";

// Visual placeholder only — no real template file or email capture wired up
// yet. The input/button are decorative (aria-hidden, disabled/non-clickable)
// so a real visitor can't submit into a void. Needs a real .xlsx asset and
// a form handler (email service or API route) before this goes live.
export function LeadMagnet() {
  return (
    <section className="font-dodio-sans">
      <Container className="pb-8 lg:pb-12">
        <div className="flex flex-col gap-4 rounded-dodio-lg bg-[#EAF3EF] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:p-7">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink lg:text-xl">
              Ještě to řešíte v Excelu?
            </h3>
            <p className="m-0 max-w-[440px] text-sm leading-[21px] text-dodio-ink-muted">
              Dáme vám aspoň naši šablonu pro evidenci dovolené, ať v tom máte pořádek, než se rozhodnete.
            </p>
          </div>
          <div aria-hidden="true" className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
            <input
              type="email"
              disabled
              placeholder="vas@email.cz"
              className="h-11 flex-1 rounded-dodio-md border border-dodio-border bg-white px-4 text-sm text-dodio-ink placeholder:text-dodio-ink-muted sm:w-56"
            />
            <span className="flex h-11 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-5 text-sm font-semibold text-white">
              Poslat šablonu
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
