import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { Pricing } from "@/components/marketing/Pricing";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

const TITLE = "Evidence dovolené a absencí pro malé firmy – Dodio";
const DESCRIPTION =
  "Přerostli jste Excel, ale nechcete drahý HR systém? Jednoduchá evidence dovolené a absencí pro firmy do 50 lidí. Paušál od 290 Kč, zdarma do 5 lidí.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/pro-male-firmy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/pro-male-firmy",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const FOR_WHOM = [
  { who: "E-shopy", body: "víte, kdo bude ve skladu a na zákaznické podpoře i v sezóně." },
  { who: "Digitální agentury", body: "plánujete dovolené tak, aby klientské projekty měly vždy pokrytí." },
  {
    who: "Vývojářská studia",
    body: "přehled dovolených a home office v jednom kalendáři, propojeném s Google Kalendářem nebo Outlookem.",
  },
  { who: "Kancelářské a administrativní týmy", body: "konec tabulek a podkladů pro mzdy přepisovaných ručně." },
];

const FAQ_ITEMS = [
  {
    q: "Vyplatí se Dodio už pro 8 lidí?",
    a: "Tarif Starter pro tým do 10 lidí stojí 290 Kč měsíčně, při 8 lidech tedy zhruba 36 Kč na člověka.",
  },
  {
    q: "Potřebujeme Slack nebo Teams?",
    a: "Ne. Upozornění chodí v Dodiu a e-mailem a schvaluje se přímo v aplikaci. Napojení na Slack, Microsoft Teams a Discord chystáme.",
  },
  {
    q: "Co když vyrosteme nad 30 lidí?",
    a: "Zůstanete na tarifu Pro a za každého dalšího člověka nad 30 připlatíte 39 Kč měsíčně.",
  },
];

export default function ProMaleFirmyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Pro malé firmy"
          h1="Dovolené a absence pro malé firmy"
          perex="Přerostli jste Excel, ale nechcete drahý HR systém? Dodio je jednoduchá evidence dovolené a absencí pro malé a střední české firmy. Nastavení za pár minut, žádné školení a žádné platby za funkce, které nepotřebujete."
        />

        <section>
          <Container className="flex flex-col gap-4 py-12 lg:py-16">
            <h2 className={H2}>Postavené pro týmy, kde HR dělá jednatel nebo office manažerka</h2>
            <p className={BODY}>
              V malé firmě nemáte HR oddělení. Dovolené řeší majitel, office manažerka nebo vedoucí týmu
              vedle své práce. Dodio proto zvládne nastavit kdokoli za pár minut a pak běží samo.
            </p>
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="flex flex-col gap-5 py-12 lg:py-16">
            <h2 className={H2}>Pro koho Dodio je</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:gap-6">
              {FOR_WHOM.map((item) => (
                <div key={item.who} className="flex flex-col gap-1.5">
                  <div className="font-dodio-display text-lg font-bold text-dodio-ink">{item.who}</div>
                  <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section>
          <Container className="flex flex-col gap-4 py-12 lg:py-16">
            <h2 className={H2}>Jednoduchá evidence dovolené, žádné zbytečné moduly</h2>
            <p className={BODY}>
              Dodio umí dovolené, absence, home office a sick days. Neumí nábor, hodnocení ani docházku a
              nebude to předstírat. Díky tomu ho lidé začnou používat hned první den.
            </p>
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="flex flex-col gap-4 py-12 lg:py-16">
            <h2 className={H2}>Cena podle velikosti týmu, ne za každého člověka</h2>
            <p className={BODY}>
              Platíte paušál v korunách: Starter do 10 lidí za 290 Kč měsíčně, Team do 15 lidí za 590 Kč a
              Pro do 30 lidí za 1 190 Kč. Když přijmete dalšího člověka, cena se nezmění, dokud
              nepřekročíte tarif. Do 5 lidí je Dodio zdarma napořád a role HR je zdarma na každém tarifu.
            </p>
          </Container>
        </section>

        <section>
          <Container className="flex flex-col gap-4 py-12 lg:py-16">
            <h2 className={H2}>Česky a pro české firmy</h2>
            <p className={BODY}>
              České svátky, české typy absencí a exporty do CSV, Excelu a ODS pro mzdovou účetní. Žádné
              anglické HR pojmy a žádné ceny v eurech.
            </p>
          </Container>
        </section>

        <Pricing />

        <PageFaq heading="Časté dotazy pro malé firmy" items={FAQ_ITEMS} />

        <RelatedLinks
          links={[
            { label: "Bez Excelu", href: "/bez-excelu" },
            { label: "Evidence dovolené", href: "/evidence-dovolene" },
          ]}
        />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
