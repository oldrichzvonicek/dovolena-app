import { Container } from "./Container";

const TEMPLATE_URL = "/sablony/dodio-evidence-pracovni-doby-a-dovolene-2027.xlsx";

export function LeadMagnet() {
  return (
    <section className="font-dodio-sans">
      <Container className="pb-8 lg:pb-12">
        <div className="flex flex-col gap-4 rounded-dodio-lg bg-[#EAF3EF] p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:p-7">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink lg:text-xl">
              Ještě to řešíte v Excelu?
            </h3>
            <p className="m-0 max-w-[460px] text-sm leading-[21px] text-dodio-ink-muted">
              Dáme vám aspoň naši šablonu na evidenci pracovní doby, dovolené, sick days a home office pro
              rok 2027, ať v tom máte pořádek, než se rozhodnete.
            </p>
          </div>
          <a
            href={TEMPLATE_URL}
            download
            className="flex h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-dodio-md bg-dodio-teal-dark px-6 text-sm font-semibold text-white no-underline sm:w-auto"
          >
            Stáhnout šablonu (.xlsx)
          </a>
        </div>
      </Container>
    </section>
  );
}
