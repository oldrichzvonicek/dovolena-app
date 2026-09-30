import { Container } from "./Container";

const STEPS = [
  {
    title: "Zaměstnanec požádá",
    body: "Vybere termín dovolené nebo jiné absence a odešle žádost.",
  },
  {
    title: "Vedoucí schválí",
    body: "Žádost jednoduše schválí nebo zamítne přímo v appce.",
  },
  {
    title: "Tým má přehled",
    body: "Všichni podle svých oprávnění vidí aktuální stav absencí.",
  },
];

export function HowItWorks() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-10 lg:pb-[112px]">
        <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
          Jak Dodio funguje?
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-dodio-teal-dark font-dodio-display text-base font-bold text-white">
                {i + 1}
              </div>
              <div className="font-dodio-display text-xl font-bold">{step.title}</div>
              <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
