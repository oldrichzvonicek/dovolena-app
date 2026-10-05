import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { Pricing } from "@/components/marketing/Pricing";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";
import { TemplateEmailForm } from "@/components/marketing/TemplateEmailForm";
import { CheckIcon } from "@/components/marketing/icons";

const TITLE = "Evidence dovolené a absencí bez Excelu | Dodio";
const DESCRIPTION =
  "Evidence dovolené v Excelu přestává stačit? Dodio převezme zůstatky, kalendář i schvalování. Přechod z tabulky bez složité implementace. Zdarma do 5 lidí.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/bez-excelu" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/bez-excelu",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";
const LIST_ITEM = "text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const RECOGNIZE = [
  "Tabulku dovolených upravuje jen jeden člověk, a když je pryč, nikdo neví, co platí.",
  "Žádosti chodí e-mailem, v chatu i osobně a část se nikdy nezapíše.",
  "Kalendář dovolených v Excelu je nepřehledný a kolize zjistíte pozdě.",
  "Evidence absencí v Excelu žije v jiném souboru než dovolené a na konci měsíce vše přepisujete ručně do podkladů pro mzdy.",
  "Zaměstnanci neví, kolik dovolené jim zbývá, a ptají se vás.",
];

const COMPARISON = [
  { row: "Žádost o dovolenou", excel: "e-mail nebo chat", dodio: "pár sekund v aplikaci" },
  { row: "Schválení", excel: "ručně, zápis do tabulky", dodio: "jedno kliknutí, i z mobilu" },
  { row: "Zůstatky", excel: "vzorce, které se rozbijí", dodio: "počítají se automaticky" },
  { row: "Kalendář dovolených", excel: "barevné buňky", dodio: "týmová časová osa" },
  { row: "Kdo je dnes mimo", excel: "dohledat v tabulce", dodio: "týmový kalendář, aktuální pro každého" },
  { row: "Podklady pro mzdy", excel: "ruční přepis", dodio: "export do CSV, Excelu i ODS" },
  { row: "Historie změn", excel: "chybí nebo je nepřehledná", dodio: "u každé žádosti" },
  { row: "Dva lidé volno ve stejný týden", excel: "zjistíte, až je pozdě", dodio: "kapacitní varování ještě před schválením" },
];

const STEPS = [
  "Založte firmu a pozvěte lidi e-mailem.",
  "Nastavte typy absencí a nárok na dovolenou.",
  "Naimportujte zaměstnance a nastavte jejich aktuální zůstatky.",
  "Pošlete týmu odkaz a první žádosti už půjdou přes Dodio.",
];

const FAQ_ITEMS = [
  {
    q: "Můžu si původní tabulku nechat?",
    a: "Ano. Od tarifu Starter si data kdykoli vyexportujete do Excelu, CSV nebo ODS, takže přehled v tabulce můžete mít dál.",
  },
  {
    q: "Co když se tým Dodio nenaučí?",
    a: "Žádost zabere pár sekund a celé rozhraní je česky, bez anglických HR pojmů. Do 5 lidí je Dodio zdarma napořád, bez zkušební lhůty.",
  },
];

export default function BezExceluPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Evidence bez Excelu"
          h1="Evidence dovolené bez Excelu a tabulek"
          perex="Excel je skvělý, dokud vás není deset. Pak přijdou přepsané vzorce, tři verze stejného souboru a otázka „kolik mi ještě zbývá dovolené?“ každý týden. Dodio tabulku nahradí, aniž byste museli kupovat velký HR systém."
          secondaryCta={{ label: "Jak přejít z Excelu", href: "#prechod" }}
        />

        <section>
          <Container className="flex flex-col gap-5 py-12 lg:py-16">
            <h2 className={H2}>Poznáváte se?</h2>
            <div className="flex flex-col gap-3">
              {RECOGNIZE.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 shrink-0">
                    <CheckIcon />
                  </span>
                  <span className={LIST_ITEM}>{item}</span>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="flex flex-col gap-5 py-12 lg:py-16">
            <h2 className={H2}>Excel vs. Dodio</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[14px] leading-[21px]">
                <thead>
                  <tr>
                    <th className="border-b border-dodio-border p-3 text-left font-semibold text-dodio-ink"></th>
                    <th className="border-b border-dodio-border p-3 text-left font-semibold text-dodio-ink">
                      Excel / Google Sheets
                    </th>
                    <th className="border-b border-dodio-border p-3 text-left font-semibold text-dodio-teal-dark">
                      Dodio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((item) => (
                    <tr key={item.row}>
                      <td className="border-b border-dodio-border p-3 align-top font-medium text-dodio-ink">{item.row}</td>
                      <td className="border-b border-dodio-border p-3 align-top text-dodio-ink-muted">{item.excel}</td>
                      <td className="border-b border-dodio-border p-3 align-top text-dodio-ink">{item.dodio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Container>
        </section>

        <section id="prechod" className="scroll-mt-16 lg:scroll-mt-24">
          <Container className="flex flex-col gap-6 py-12 lg:py-16">
            <h2 className={H2}>Přechod z Excelu v několika krocích</h2>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((step, i) => (
                <div key={step} className="flex flex-col gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-dodio-teal-dark font-dodio-display text-sm font-bold text-white">
                    {i + 1}
                  </div>
                  <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted">{step}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section className="border-y border-dodio-border bg-dodio-surface-card">
          <Container className="flex flex-col gap-4 py-12 lg:py-16">
            <h2 className={H2}>Proč ne rovnou velký HR systém?</h2>
            <p className={BODY}>
              Velké HR systémy řeší nábor, hodnocení, mzdy i docházku a podle toho stojí a trvají. Když
              potřebujete jen pořádek v dovolených a absencích, platíte za funkce, které nevyužijete. Dodio
              stojí paušálně od 290 Kč měsíčně pro tým do 10 lidí a do 5 lidí je zdarma.
            </p>
          </Container>
        </section>

        <Pricing />

        <section>
          <Container className="flex flex-col gap-5 py-12 lg:py-16">
            <h2 className={H2}>Ještě nejste připravení přejít?</h2>
            <p className={BODY}>
              Pošleme vám aspoň naši šablonu na evidenci pracovní doby, dovolené, sick days a home office
              pro rok 2027, ať v tom máte pořádek, než se rozhodnete. A kolik dovolené vám letos patří,
              spočítáte v naší{" "}
              <a href="/kalkulacka-dovolene" className="font-medium text-dodio-teal-dark no-underline hover:underline">
                kalkulačce dovolené
              </a>
              .
            </p>
            <div className="flex flex-col gap-3 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:max-w-[480px] lg:p-7">
              <div className="text-sm font-semibold text-dodio-ink">Pošleme vám odkaz ke stažení e-mailem</div>
              <TemplateEmailForm />
            </div>
          </Container>
        </section>

        <PageFaq heading="Časté dotazy k přechodu z Excelu" items={FAQ_ITEMS} />

        <RelatedLinks
          links={[
            { label: "Evidence dovolené", href: "/evidence-dovolene" },
            { label: "Evidence absencí", href: "/evidence-absenci" },
            { label: "Pro malé firmy", href: "/pro-male-firmy" },
          ]}
        />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
