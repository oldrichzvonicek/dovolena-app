import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { TemplateEmailForm } from "@/components/marketing/TemplateEmailForm";
import { CheckIcon } from "@/components/marketing/icons";
import { SIGNUP_URL } from "@/lib/dodio-links";

const TITLE = "Šablona pro evidenci docházky 2027 zdarma (Excel) – Dodio";
const DESCRIPTION =
  "Zdarma ke stažení: Excel šablona pro evidenci pracovní doby, dovolené, sick days a home office na rok 2027. 12 měsíčních listů, české státní svátky a automatické výpočty zůstatků.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/sablona-dochazky-2027" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/sablona-dochazky-2027",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const CONTENTS = [
  "12 měsíčních listů (leden–prosinec 2027) s automatickým výpočtem odpracovaných hodin a přesčasů",
  "Hotový přehled státních svátků 2027 — nemusíte je hlídat ručně ani dohledávat",
  "Roční přehled se zůstatky dovolené, sick days a home office na jednom místě",
  "Nastavitelná pracovní doba a stravenkový paušál podle vaší firmy",
  "Vyplníte jednou v listu Předvolby, zbytek roku se počítá automaticky",
];

const FOR_WHOM = [
  "Mikrofirmy a OSVČ, které zatím nepoužívají žádný software na docházku",
  "Malé týmy, co řeší docházku v Excelu a chtějí přehlednější, hotový vzor",
  "Firmy, které zvažují přechod na software a chtějí nejdřív vidět, co všechno se dá evidovat",
];

const STEPS = [
  { title: "Stáhněte si šablonu", body: "Otevřete ji v Excelu nebo Google Sheets — funguje v obou." },
  {
    title: "Vyplňte list Předvolby",
    body: "Jméno, firma, nárok na dovolenou a pracovní dobu zadáte jednou na začátku.",
  },
  {
    title: "Zapisujte docházku",
    body: "Do měsíčních listů zapisujete jen příchody a odchody — hodiny, přesčasy i zůstatky se počítají samy.",
  },
];

const TEMPLATE_FAQ = [
  {
    q: "Je šablona opravdu zdarma?",
    a: "Ano, bez skrytých podmínek a bez platební karty. Stačí zadat e-mail, na který vám pošleme odkaz ke stažení.",
  },
  {
    q: "Funguje šablona i v Google Sheets?",
    a: "Ano. Soubor je ve formátu .xlsx, který si Google Sheets otevře i s funkcemi a přepočítá bez úprav.",
  },
  {
    q: "Můžu si šablonu upravit podle svých potřeb?",
    a: "Ano — listy nejsou uzamčené, takže si přidáte vlastní sloupce nebo upravíte vzorce, jak potřebujete.",
  },
  {
    q: "Co když nám šablona přestane stačit?",
    a: "Pak je čas na Dodio — žádosti na tři kliknutí, rychlé schválení a export pro mzdy, místo ručního přepisování v Excelu.",
  },
];

export default function TemplateLandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <section>
          <Container className="grid grid-cols-1 items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div className="flex flex-col gap-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#E3F2EC] px-3 py-1.5 text-xs font-semibold text-dodio-teal-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal" />
                Zdarma ke stažení
              </div>
              <h1 className="m-0 font-dodio-display text-[34px] font-extrabold leading-[40px] tracking-[-0.5px] text-dodio-ink lg:text-[52px] lg:leading-[56px] lg:tracking-[-1px]">
                Šablona pro evidenci docházky 2027
              </h1>
              <p className="m-0 max-w-[480px] text-[17px] leading-[26px] text-dodio-ink-muted">
                Excel tabulka pro evidenci pracovní doby, dovolené, sick days a home office na celý rok
                2027 — s hotovými českými státními svátky a automatickými výpočty zůstatků. Zdarma, bez
                platební karty.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:p-8">
              <div className="text-sm font-semibold text-dodio-ink">Pošleme vám odkaz ke stažení e-mailem</div>
              <TemplateEmailForm layoutClassName="sm:flex-col" inputClassName="h-12 w-full rounded-dodio-md border border-dodio-border bg-white px-4 text-sm text-dodio-ink placeholder:text-dodio-ink-muted" buttonClassName="flex h-12 w-full items-center justify-center rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white disabled:opacity-70" />
            </div>
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="grid grid-cols-1 gap-10 py-14 lg:grid-cols-2 lg:gap-16 lg:py-20">
            <div className="flex flex-col gap-5">
              <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
                Co šablona obsahuje
              </h2>
              <div className="flex flex-col gap-3">
                {CONTENTS.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="mt-1 shrink-0">
                      <CheckIcon />
                    </span>
                    <span className="text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
                Pro koho je šablona
              </h2>
              <div className="flex flex-col gap-3">
                {FOR_WHOM.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="mt-1 shrink-0">
                      <CheckIcon />
                    </span>
                    <span className="text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section>
          <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-20">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
              Jak šablonu používat
            </h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex flex-col gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dodio-teal-dark font-dodio-display text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <div className="font-dodio-display text-lg font-bold">{step.title}</div>
                  <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="bg-dodio-teal-dark">
          <Container className="flex flex-col gap-4 py-14 text-center lg:py-16">
            <h2 className="m-0 font-dodio-display text-2xl font-extrabold text-white lg:text-[32px] lg:leading-[38px]">
              Kdy je čas na něco chytřejšího než Excel
            </h2>
            <p className="m-0 mx-auto max-w-[560px] text-[15px] leading-[23px] text-[#D7EEE6] lg:text-lg lg:leading-[28px]">
              Excel funguje, dokud tabulku upravuje jeden člověk. Jakmile roste tým, přibývají chyby,
              duplicitní žádosti a ruční dopočítávání. Dodio dělá to samé automaticky — žádost na tři
              kliknutí, rychlé schválení a export pro mzdy.
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
              Otázky k šabloně
            </h2>
            <div className="flex flex-col">
              {TEMPLATE_FAQ.map((item, i) => (
                <details
                  key={item.q}
                  className={`border-t border-dodio-border py-5 ${i === TEMPLATE_FAQ.length - 1 ? "border-b" : ""}`}
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
