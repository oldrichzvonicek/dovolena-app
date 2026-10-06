import { Container } from "./Container";
import { SIGNUP_URL } from "@/lib/dodio-links";

export function FinalCTA() {
  return (
    <section className="font-dodio-sans">
      <Container className="pb-14 lg:pb-[112px]">
        <div className="relative flex flex-col gap-5 overflow-hidden rounded-dodio-xl bg-dodio-teal-dark p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-[72px_80px]">
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-10"
          >
            <circle cx="80" cy="80" r="80" fill="#0F9D7C" opacity="0.35" />
          </svg>
          <div className="relative flex flex-col gap-3.5 lg:gap-3.5">
            <h2 className="m-0 max-w-[640px] font-dodio-display text-[30px] font-extrabold leading-[36px] text-white lg:text-[48px] lg:leading-[54px] lg:tracking-[-1px]">
              Přestaňte řešit absence v tabulkách.
            </h2>
            <p className="m-0 hidden text-lg leading-[28px] text-[#D7EEE6] lg:block">
              Přesuňte dovolené, žádosti a evidenci absencí na jedno místo.
            </p>
          </div>
          <div className="relative flex flex-col items-start gap-3 lg:items-end">
            <a
              href={SIGNUP_URL}
              className="shrink-0 rounded-dodio-md bg-dodio-coral px-7 py-4 text-center text-base font-bold text-dodio-coral-dark no-underline lg:px-[30px] lg:py-[18px] lg:text-lg"
            >
              Vyzkoušet zdarma
            </a>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#D7EEE6] lg:justify-end">
              <span>Do 5 lidí zdarma. Bez platební karty.</span>
              <span aria-hidden="true">·</span>
              <a
                href="/bez-excelu"
                data-link-location="final-cta-secondary"
                className="whitespace-nowrap font-medium text-white no-underline hover:underline"
              >
                Jak přejít z Excelu →
              </a>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
