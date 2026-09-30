import { Container } from "./Container";
import { TemplateEmailForm } from "./TemplateEmailForm";

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
              rok 2027, ať v tom máte pořádek, než se rozhodnete.{" "}
              <a href="/sablona-dochazky-2027" className="text-dodio-teal-dark underline underline-offset-2">
                Co všechno šablona umí
              </a>
              .
            </p>
          </div>
          <TemplateEmailForm layoutClassName="sm:w-auto" />
        </div>
        <p className="m-0 mt-3 text-sm text-dodio-ink-muted">
          Nevíte, kolik dovolené vám letos patří?{" "}
          <a href="/kalkulacka-dovolene" className="text-dodio-teal-dark underline underline-offset-2">
            Spočítejte si to v kalkulačce
          </a>
          .
        </p>
      </Container>
    </section>
  );
}
