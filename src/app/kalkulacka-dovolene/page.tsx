import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { VacationCalculator } from "@/components/marketing/VacationCalculator";
import { SIGNUP_URL } from "@/lib/dodio-links";

const TITLE = "Kalkulačka nároku na dovolenou zdarma – Dodio";
const DESCRIPTION =
  "Spočítejte si orientační nárok na dovolenou podle týdenního úvazku a odpracovaných týdnů. Zdarma, bez registrace.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/kalkulacka-dovolene" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/kalkulacka-dovolene",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const CALC_FAQ = [
  {
    q: "Proč se dovolená počítá v hodinách, ne ve dnech?",
    a: "Od roku 2021 zákoník práce počítá dovolenou v hodinách podle týdenní pracovní doby, ne v celých dnech. Díky tomu je nárok spravedlivý i při nerovnoměrně rozvrženém úvazku (např. různě dlouhé směny).",
  },
  {
    q: "Co když jsem byl/a část roku nemocný/á nebo na mateřské?",
    a: "Některé náhradní doby (typicky prvních 20 dní nemoci v roce, mateřská dovolená) se pro účely nároku na dovolenou počítají jako odpracované. Tahle kalkulačka to nezohledňuje — pro přesný výpočet v takovém případě se obraťte na HR nebo mzdovou účetní.",
  },
  {
    q: "Musí mít firma jen zákonné 4 týdny dovolené?",
    a: "4 týdny jsou zákonné minimum v soukromé sféře. Řada firem dává 5 týdnů jako benefit, u zaměstnavatelů ve veřejné správě je to ze zákona minimálně 5 týdnů, u pedagogů 8 týdnů.",
  },
  {
    q: "Je tenhle výpočet přesný jako na výplatní pásce?",
    a: "Ne, je orientační. Skutečný výpočet mzdová účetní dělá s ohledem na všechny náhradní doby, změny úvazku během roku a konkrétní pravidla vaší firmy. Dodio tohle počítá automaticky za vás, průběžně a bez chyb.",
  },
];

export default function VacationCalculatorPage() {
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
                Kalkulačka nároku na dovolenou
              </h1>
              <p className="m-0 max-w-[480px] text-[17px] leading-[26px] text-dodio-ink-muted">
                Zadejte týdenní úvazek a odpracované týdny a zjistíte orientační nárok na dovolenou v
                hodinách i dnech podle aktuálního zákoníku práce.
              </p>
            </div>
            <VacationCalculator />
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="flex flex-col gap-5 py-14 lg:py-20">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
              Jak se nárok na dovolenou počítá
            </h2>
            <p className="m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
              Od novely zákoníku práce v roce 2021 se dovolená počítá v hodinách podle stanovené týdenní
              pracovní doby, ne v celých dnech. Základní vzorec: odpracované týdny v roce vydělené 52,
              vynásobené týdenním úvazkem v hodinách a počtem týdnů dovolené, na které máte nárok (zákonné
              minimum jsou 4 týdny). Když odpracujete celý rok (52 fiktivních týdnů) na plný úvazek se 4
              týdny dovolené, vyjde vám standardních 160 hodin, tedy 4 týdny po 40 hodinách.
            </p>
          </Container>
        </section>

        <section className="bg-dodio-teal-dark">
          <Container className="flex flex-col gap-4 py-14 text-center lg:py-16">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold text-white lg:text-[32px] lg:leading-[38px]">
              Přestaňte počítat dovolenou ručně
            </h2>
            <p className="m-0 mx-auto max-w-[560px] text-[15px] leading-[23px] text-[#D7EEE6] lg:text-lg lg:leading-[28px]">
              Dodio hlídá zůstatky, přepočítává nárok automaticky a nikdy nezapomene na náhradní dobu.
              Žádost na tři kliknutí, rychlé schválení a export pro mzdy.
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
