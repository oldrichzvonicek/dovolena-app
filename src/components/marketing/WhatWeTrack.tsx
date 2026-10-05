import { Container } from "./Container";

const ITEMS = [
  {
    title: "Dovolená",
    body: "Čerpáno, naplánováno a zbývá; celé dny, půldny i hodiny.",
    href: "/evidence-dovolene",
  },
  {
    title: "Absence",
    body: "Nemoc, lékař, náhradní volno, neplacené volno i vlastní typy.",
    href: "/evidence-absenci",
  },
  {
    title: "Home office",
    body: "Žádosti, schvalování a přehled, kdo pracuje z domova.",
    href: "/home-office",
  },
  {
    title: "Sick days",
    body: "Firemní benefit s vlastním počtem dní a přehledem zůstatku.",
    href: "/sick-days",
  },
];

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

export function WhatWeTrack() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Co v Dodiu evidujete
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Čtyři typy absencí, jedno místo.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex flex-col gap-2 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 no-underline hover:border-dodio-teal"
            >
              <div className="font-dodio-display text-lg font-bold text-dodio-ink">{item.title}</div>
              <p className="m-0 text-[15px] leading-[22px] text-dodio-ink-muted">{item.body}</p>
              <span className="mt-1 text-sm font-medium text-dodio-teal-dark">Zjistit víc →</span>
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-4 border-t border-dodio-border pt-8 lg:pt-10">
          <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
            Podle vaší situace
          </div>
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
        </div>
      </Container>
    </section>
  );
}
