import { Container } from "./Container";

// Visual placeholder only — no real template file or email capture wired up
// yet. The input/button are decorative (aria-hidden, disabled/non-clickable)
// so a real visitor can't submit into a void. Needs a real .xlsx asset and
// a form handler (email service or API route) before this goes live.
export function LeadMagnet() {
  return (
    <section className="font-dodio-sans">
      <Container className="pb-14 lg:pb-[112px]">
        <div className="flex flex-col gap-6 rounded-dodio-xl border border-dodio-border bg-dodio-surface-card p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-[56px_64px]">
          <div className="flex flex-col gap-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
              Ještě se nerozhodli?
            </div>
            <h3 className="m-0 max-w-[480px] font-dodio-display text-2xl font-extrabold leading-[30px] text-dodio-ink lg:text-[32px] lg:leading-[38px]">
              Stáhněte si Excel šablonu pro evidenci dovolené 2027 zdarma.
            </h3>
            <p className="m-0 max-w-[480px] text-[15px] leading-[23px] text-dodio-ink-muted">
              Pošleme vám ji na e-mail. Žádný závazek, žádná platební karta.
            </p>
          </div>
          <div aria-hidden="true" className="flex w-full flex-col gap-2.5 sm:flex-row lg:w-auto">
            <input
              type="email"
              disabled
              placeholder="vas@email.cz"
              className="h-12 flex-1 rounded-dodio-md border border-dodio-border bg-dodio-surface px-4 text-sm text-dodio-ink placeholder:text-dodio-ink-muted lg:w-64"
            />
            <span className="flex h-12 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-6 text-sm font-semibold text-white">
              Poslat šablonu
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
