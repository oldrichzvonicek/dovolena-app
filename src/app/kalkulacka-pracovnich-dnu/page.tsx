import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { WorkingDaysCalculator } from "@/components/marketing/WorkingDaysCalculator";
import { SIGNUP_URL } from "@/lib/dodio-links";

const TITLE = "Kalkulačka pracovních dnů a státních svátků – Dodio";
const DESCRIPTION =
  "Zjistěte, kolik pracovních dní má rok nebo konkrétní měsíc, včetně přehledu českých státních svátků. Zdarma, bez registrace.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/kalkulacka-pracovnich-dnu" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/kalkulacka-pracovnich-dnu",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const CALC_FAQ = [
  {
    q: "Odkud se berou data o státních svátcích?",
    a: "Ze zákona č. 245/2000 Sb., o státních svátcích. Kalendářně pevná data (např. 1. května) se nemění, pohyblivé svátky (Velký pátek, Velikonoční pondělí) se dopočítávají podle data Velikonoc pro daný rok.",
  },
  {
    q: "Počítáte i soboty a neděle?",
    a: "Ano, automaticky se odečítají jako víkendové dny. Pokud státní svátek vyjde na víkend, žádný pracovní den navíc neubere — přesně jak to funguje v praxi.",
  },
  {
    q: "Platí to i pro zkrácené úvazky nebo směnný provoz?",
    a: "Kalkulačka počítá standardní pětidenní pracovní týden (pondělí až pátek). Pro nerovnoměrně rozvržený úvazek nebo směnný provoz se počet pracovních dní může lišit.",
  },
];

export default function WorkingDaysCalculatorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <section>
          <Container className="grid grid-cols-1 items-start gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div className="flex flex-col gap-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#E3F2EC] px-3 py-1.5 text-xs font-semibold text-dodio-teal-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal" />
                Zdarma nástroj
              </div>
              <h1 className="m-0 font-dodio-display text-[34px] font-extrabold leading-[40px] tracking-[-0.5px] text-dodio-ink lg:text-[52px] lg:leading-[56px] lg:tracking-[-1px]">
                Kalkulačka pracovních dnů a svátků
              </h1>
              <p className="m-0 max-w-[480px] text-[17px] leading-[26px] text-dodio-ink-muted">
                Vyberte rok a případně měsíc a zjistíte přesný počet pracovních dní i přehled státních
                svátků, které do něj spadají.
              </p>
            </div>
            <WorkingDaysCalculator />
          </Container>
        </section>

        <section className="bg-dodio-teal-dark">
          <Container className="flex flex-col gap-4 py-14 text-center lg:py-16">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold text-white lg:text-[32px] lg:leading-[38px]">
              Svátky, které hlídá appka, ne vy
            </h2>
            <p className="m-0 mx-auto max-w-[560px] text-[15px] leading-[23px] text-[#D7EEE6] lg:text-lg lg:leading-[28px]">
              Dodio počítá se státními svátky automaticky v týmovém kalendáři i při žádostech o dovolenou —
              nikdy se nezapočítají do čerpání.
            </p>
            <div className="pt-2">
              <a
                href={SIGNUP_URL}
                className="inline-block rounded-dodio-md bg-dodio-coral px-7 py-3.5 text-base font-bold text-dodio-coral-dark no-underline"
              >
                Vyzkoušet Dodio zdarma
              </a>
            </div>
          </Container>
        </section>

        <section>
          <Container className="flex flex-col gap-6 py-14 lg:py-20">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
              Otázky ke kalkulačce
            </h2>
            <div className="flex flex-col">
              {CALC_FAQ.map((item, i) => (
                <details
                  key={item.q}
                  className={`border-t border-dodio-border py-5 ${i === CALC_FAQ.length - 1 ? "border-b" : ""}`}
                >
                  <summary className="cursor-pointer font-dodio-display text-lg font-bold">{item.q}</summary>
                  <p className="m-0 mt-3 text-[15px] leading-[24px] text-dodio-ink-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
