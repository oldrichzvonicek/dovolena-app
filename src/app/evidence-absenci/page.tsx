import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { PageCta } from "@/components/marketing/PageCta";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

const TITLE = "Evidence absencí zaměstnanců online | Dodio";
const DESCRIPTION =
  "Nemoc, lékař, náhradní volno i dovolená v jednom systému. Přehled o nepřítomnosti zaměstnanců a exporty pro mzdovou účetní. Zdarma do 5 lidí.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/evidence-absenci" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/evidence-absenci",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const SECTIONS = [
  {
    heading: "Systém pro evidenci absencí všech typů",
    body: "Dodio zná typy absencí podle české praxe: dovolená, nemoc, lékař, náhradní volno, neplacené volno, home office a sick day. Další typy a pravidla čerpání si nastavíte přesně podle vaší firmy.",
  },
  {
    heading: "Přehled, kdo dnes chybí",
    body: "V týmovém kalendáři každý vidí, kdo je tento týden mimo. Kalendář seskupíte podle oddělení a vyfiltrujete podle typu absence nebo jména. Už se nemusíte ptát do chatu, jestli kolega přijde.",
  },
  {
    heading: "Evidence nepřítomnosti zaměstnanců s historií",
    body: "U každé absence je dohledatelné, kdo ji zadal a kdo ji kdy schválil. Podrobný audit log všech změn je v tarifu Team. Nemoc přitom zůstává soukromá: kolegové vidí jen „Nepřítomen“, typ absence zná jen nadřízený a HR.",
  },
  {
    heading: "Nemocnost po odděleních, bezpečně pro GDPR",
    body: "V tarifu Pro uvidíte anonymní nemocnost po odděleních. Jen u oddělení s pěti a více lidmi a nikdy jmenovitě.",
  },
  {
    heading: "Správa absencí zaměstnanců bez přepisování",
    body: "Od tarifu Starter stáhnete měsíční mzdový podklad v CSV, Excelu nebo ODS. Mzdová účetní dostane podklady v jednotném formátu, ne pět různých tabulek, a může mít do Dodia vlastní přístup.",
  },
  {
    heading: "Software pro evidenci absencí, který lidé opravdu použijí",
    body: "Online evidence absencí běží v prohlížeči na počítači, tabletu i mobilu, bez instalace. Žádost zabere pár sekund. Když je zadávání jednoduché, lidé absence zapisují včas a přehled zůstává aktuální.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Je Dodio docházkový systém?",
    a: "Ne. Dodio eviduje nepřítomnost, ne odpracované hodiny, příchody a odchody.",
  },
  {
    q: "Můžu přidat vlastní typ absence?",
    a: "Ano. Vlastní typy absencí i pravidla čerpání nastavíte podle vaší firmy.",
  },
  {
    q: "Vidí kolegové, proč chybím?",
    a: "Ne. U nemoci kolegové vidí jen „Nepřítomen“. Typ absence zná jen nadřízený a HR.",
  },
];

export default function EvidenceAbsenciPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Evidence absencí"
          h1="Evidence absencí zaměstnanců"
          perex="Nemoc, návštěva lékaře, náhradní volno, home office. Každá absence zaměstnanců jinde: něco v e-mailu, něco v chatu, něco v tabulce. Dodio je dá na jedno místo."
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
          heading="Mějte přehled o absencích celého týmu"
          body="Dovolená, nemoc, home office i sick days na jednom místě, s historií a exporty pro mzdy. Žádost na pár kliknutí, rychlé schválení."
        />

        <PageFaq heading="Časté dotazy k evidenci absencí" items={FAQ_ITEMS} />

        <RelatedLinks
          links={[
            { label: "Evidence dovolené", href: "/evidence-dovolene" },
            { label: "Sick days", href: "/sick-days" },
            { label: "Home office", href: "/home-office" },
          ]}
        />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
