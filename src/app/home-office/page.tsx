import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { PageCta } from "@/components/marketing/PageCta";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

const TITLE = "Evidence home office zaměstnanců | Dodio";
const DESCRIPTION =
  "Žádost o home office za pár sekund, schválení jedním kliknutím a přehled, kdo pracuje z domova. Jednoduchá evidence home office pro malé firmy.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/home-office" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/home-office",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const SECTIONS = [
  {
    heading: "Žádost o home office bez zpráv v chatu",
    body: "Zaměstnanec vybere dny a odešle žádost. Žádné „můžu zítra z domu?“ ztracené ve vlákně. Vedoucí má všechny žádosti na jednom místě.",
  },
  {
    heading: "Schvalování home office jedním tlačítkem",
    body: "Žádost schválíte jedním kliknutím v Dodiu, na počítači i v mobilu. Upozornění přijde v Dodiu a e-mailem, takže nemusíte nic dohledávat. Napojení na Slack a Microsoft Teams chystáme.",
  },
  {
    heading: "Plánování home office a dnů v kanceláři",
    body: "Kalendář ukazuje, kdo je který den doma a kdo v kanceláři. Plánování práce z domova tak nekoliduje s poradami, společnými dny ani obsazením recepce. Od tarifu Starter se home office propíše i do Google Kalendáře nebo Outlooku.",
  },
  {
    heading: "Evidence práce z domova pro firemní pravidla",
    body: "Každý vidí, kolik dní home office má letos za sebou a kolik naplánováno. Pravidla čerpání nastavíte podle vaší firmy a od tarifu Starter si data vyexportujete, třeba jako podklad k náhradě nákladů na práci z domova.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Jak schválím home office, když nejsem u počítače?",
    a: "Z mobilu, jedním kliknutím. Dodio běží v prohlížeči bez instalace.",
  },
  {
    q: "Vidí kolegové, kdo je doma?",
    a: "Ano, v týmovém kalendáři, kde je home office odlišený vlastní barvou.",
  },
  {
    q: "Odečítá se home office z dovolené?",
    a: "Ne. Home office je samostatný typ a zůstatek dovolené neovlivní.",
  },
];

export default function HomeOfficePage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Home office"
          h1="Evidence a schvalování home office"
          perex="Home office je dnes běžný, jenže bez evidence se v něm rychle ztratí přehled. Dodio vám pomůže mít přehled, kdo kdy pracuje z domova a kdo bude v kanceláři."
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
          heading="Přehled o home office bez tabulek a chatu"
          body="Žádost za pár sekund, schválení jedním kliknutím a kalendář, kdo je dnes doma. Zdarma do 5 lidí, bez platební karty."
        />

        <PageFaq heading="Časté dotazy k evidenci home office" items={FAQ_ITEMS} />

        <RelatedLinks links={[{ label: "Evidence absencí zaměstnanců", href: "/evidence-absenci" }]} />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
