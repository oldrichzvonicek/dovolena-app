import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { PageCta } from "@/components/marketing/PageCta";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

const TITLE = "Evidence dovolené zaměstnanců online | Dodio";
const DESCRIPTION =
  "Evidence a plánování dovolených bez tabulek. Zůstatky, kalendář dovolených a schvalování jedním kliknutím. Celé dny, půldny i hodiny. Zdarma do 5 lidí.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/evidence-dovolene" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/evidence-dovolene",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const SECTIONS = [
  {
    heading: "Online evidence dovolené, která se počítá sama",
    body: "Každý zaměstnanec vidí na první pohled, kolik dovolené má čerpáno, naplánováno a kolik mu zbývá. Požádat může o celý den, půlden i hodiny a víkendy se státními svátky se odečtou automaticky. V tarifu Team Dodio nárok na dovolenou i sám vypočítá.",
  },
  {
    heading: "Kalendář dovolených pro celý tým",
    body: "Evidence dovolených celého týmu na jedné časové ose, po týmech nebo odděleních. Plánování dovolených v létě nebo kolem Vánoc přestane být hádání. Kolize uvidíte dřív, než žádost schválíte.",
  },
  {
    heading: "Schvalování dovolené na jedno kliknutí",
    body: "Žádost přijde vedoucímu do Dodia a e-mailem. Schválí nebo zamítne ji jedním kliknutím na počítači i v mobilu a zaměstnanec stav žádosti vidí okamžitě. V tarifu Pro si vedoucí nastaví zástupce na dobu své nepřítomnosti, aby schvalování nestálo.",
  },
  {
    heading: "Plánování dovolené zaměstnanců bez kolizí",
    body: "Než vedoucí žádost schválí, Dodio ho upozorní, pokud by v týmu zbylo méně lidí, než je potřeba. Zaměstnanci si navíc můžou dovolenou nejdřív soukromě naplánovat a Dodio jim navrhne, kdy si vzít pár dní kolem svátku a mít delší volno. Od tarifu Starter se schválená dovolená propíše do Google Kalendáře nebo Outlooku.",
  },
  {
    heading: "Správa dovolené zaměstnanců pro účetní",
    body: "Od tarifu Starter stáhnete měsíční mzdový podklad v CSV, Excelu nebo ODS, včetně vyrovnání dovolené při odchodu zaměstnance. Účetní může mít do Dodia vlastní přístup. V tarifu Pro navíc uvidíte riziko propadnutí dovolené a kolik peněz firmy leží v nevyčerpaných dnech.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Počítá Dodio se státními svátky?",
    a: "Ano. České státní svátky se do dovolené nezapočítávají a v kalendáři jsou vidět automaticky.",
  },
  {
    q: "Jde nastavit různý nárok na dovolenou pro různé lidi?",
    a: "Ano. Pravidla čerpání nastavíte přesně podle vaší firmy a v tarifu Team Dodio nárok vypočítá automaticky.",
  },
  {
    q: "Dá se požádat o půlden dovolené?",
    a: "Ano. Žádost jde podat na celý den, půlden i na hodiny.",
  },
  {
    q: "Co když už máme dovolené v Excelu?",
    a: "Zaměstnance naimportujete hromadně a aktuální zůstatky nastavíte při zavedení. Víc na stránce Evidence dovolené bez Excelu.",
    node: (
      <>
        Zaměstnance naimportujete hromadně a aktuální zůstatky nastavíte při zavedení. Víc na stránce{" "}
        <a href="/bez-excelu" className="font-medium text-dodio-teal-dark no-underline hover:underline">
          Evidence dovolené bez Excelu
        </a>
        .
      </>
    ),
  },
];

export default function EvidenceDovolenePage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Evidence dovolené"
          h1="Evidence a plánování dovolených zaměstnanců"
          perex="Kolik dní dovolené komu zbývá, kdo je v srpnu pryč a jestli nebudou chybět dva lidé ze stejného týmu najednou. V Dodiu to uvidíte na první pohled, bez přepočítávání tabulky."
        />

        {SECTIONS.map((section, i) => (
          <section key={section.heading} className={i % 2 === 1 ? "border-y border-dodio-border bg-dodio-surface-card" : undefined}>
            <Container className="flex flex-col gap-4 py-12 lg:py-16">
              <h2 className={H2}>{section.heading}</h2>
              <p className={BODY}>{section.body}</p>
            </Container>
          </section>
        ))}

        <PageCta
          heading="Přestaňte počítat dovolenou ručně"
          body="Dodio hlídá zůstatky, upozorní na kolize a propočítá nárok automaticky. Žádost na pár kliknutí, rychlé schválení a export pro mzdy."
        />

        <PageFaq heading="Časté dotazy k evidenci dovolené" items={FAQ_ITEMS} />

        <RelatedLinks
          links={[
            { label: "Evidence absencí", href: "/evidence-absenci" },
            { label: "Evidence dovolené bez Excelu", href: "/bez-excelu" },
          ]}
        />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
