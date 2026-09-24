import { Container } from "./Container";
import { enterpriseFaqAnswer } from "@/lib/dodio-pricing";

const QUESTIONS = [
  {
    q: "Počítá Dodio s českými svátky?",
    a: "Ano. Státní svátky jsou v kalendáři vyznačené automaticky a do čerpání dovolené se nezapočítávají.",
  },
  {
    q: "Do jakých mzdových systémů umíte exportovat?",
    a: "Exporty ve formátu CSV, XLSX a PDF jsou připravené pro Pohodu, Pamicu a VEMA. Najdete je v tarifech Starter, Pro a Enterprise.",
  },
  {
    q: "Potřebujeme Slack nebo Teams?",
    a: "Ne. Dodio funguje samostatně ve webovém prohlížeči. Napojení na Slack a Teams je volitelný doplněk.",
  },
  {
    q: "Co když nás je víc než 30?",
    a: enterpriseFaqAnswer(),
  },
];

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="grid grid-cols-1 gap-8 py-14 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-20 lg:py-[112px]">
        <div className="flex flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Časté otázky
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Než se zeptáte.
          </h2>
        </div>
        <div className="flex flex-col">
          {QUESTIONS.map((item, i) => (
            <details
              key={item.q}
              className={`border-t border-dodio-border py-5 lg:py-6 ${
                i === QUESTIONS.length - 1 ? "border-b" : ""
              }`}
            >
              <summary className="cursor-pointer font-dodio-display text-lg font-bold lg:text-xl">
                {item.q}
              </summary>
              <p className="m-0 mt-3 text-[15px] leading-[24px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
