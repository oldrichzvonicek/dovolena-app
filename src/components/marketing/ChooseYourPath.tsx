import { Container } from "./Container";

const SITUATIONS = [
  {
    title: "Přecházíte z Excelu?",
    body: "Jak Dodio nahradí tabulku, vzorce i ruční přepisování do podkladů pro mzdy.",
    href: "/bez-excelu",
    cta: "Jak přejít z Excelu",
  },
  {
    title: "Jste malá firma?",
    body: "Jednoduchá evidence pro týmy, kde dovolené řeší jednatel nebo office manažerka vedle své práce.",
    href: "/pro-male-firmy",
    cta: "Dodio pro malé firmy",
  },
];

export function ChooseYourPath() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-5 pb-14 lg:gap-6 lg:pb-[104px]">
        <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">Podle vaší situace</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
          {SITUATIONS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col gap-2 rounded-dodio-lg border-2 border-dodio-teal-dark bg-white p-6 no-underline hover:bg-dodio-surface-card"
            >
              <div className="font-dodio-display text-lg font-bold text-dodio-ink">{item.title}</div>
              <p className="m-0 text-[15px] leading-[22px] text-dodio-ink-muted">{item.body}</p>
              <span className="mt-1 text-sm font-medium text-dodio-teal-dark">{item.cta} →</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
