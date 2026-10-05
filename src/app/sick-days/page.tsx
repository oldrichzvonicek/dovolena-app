import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { PageHero } from "@/components/marketing/PageHero";
import { PageCta } from "@/components/marketing/PageCta";
import { PageFaq } from "@/components/marketing/PageFaq";
import { RelatedLinks } from "@/components/marketing/RelatedLinks";

const TITLE = "Evidence sick days zaměstnanců | Dodio";
const DESCRIPTION =
  "Sick days jako benefit, ne jako chaos v tabulce. Limit pro každého, žádost za pár sekund a přehled čerpání. Jednoduchá evidence sick days.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/sick-days" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/sick-days",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

const H2 = "m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]";
const BODY = "m-0 max-w-[720px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]";

const SECTIONS = [
  {
    heading: "Limit sick days pro každého zaměstnance",
    body: "Nastavíte, kolik sick days má kdo na rok, a Dodio odečítá čerpání automaticky. Zaměstnanec vidí čerpáno, naplánováno i kolik mu zbývá, a nemusí se ptát.",
  },
  {
    heading: "Žádost o sick day i ráno z postele",
    body: "Když je někomu ráno špatně, zadá sick day z mobilu za pár sekund. Vedoucí dostane upozornění v Dodiu a e-mailem a tým v kalendáři vidí, že kolega dnes chybí.",
  },
  {
    heading: "Schvalování sick days podle vašich pravidel",
    body: "Sick day vedoucí schválí jedním kliknutím stejně jako ostatní žádosti. Počet dní a pravidla čerpání si nastavíte podle firmy.",
  },
  {
    heading: "Sick day ve firmě odděleně od nemocenské",
    body: "Sick day je firemní benefit, ne pracovní neschopnost. V Dodiu jsou to dva oddělené typy absence, takže mzdová účetní v exportu jasně vidí, co je co. U nemoci navíc kolegové vidí jen „Nepřítomen“.",
  },
];

const FAQ_ITEMS = [
  {
    q: "Je sick day zakotvený v zákoně?",
    a: "Ne. Sick days jsou dobrovolný benefit zaměstnavatele a pravidla si určuje firma sama.",
  },
  {
    q: "Kolik sick days máme lidem dát?",
    a: "Počet je čistě na vás. Dodio pohlídá zůstatek, ať nastavíte jakýkoli.",
  },
  {
    q: "Musíme kvůli tomu něco instalovat?",
    a: "Ne. Dodio běží v prohlížeči na počítači, tabletu i mobilu.",
  },
];

export default function SickDaysPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main>
        <PageHero
          eyebrow="Sick days"
          h1="Evidence a schvalování sick days"
          perex="Sick days zaměstnanců jsou oblíbený benefit, ale jejich evidence často končí v poznámkách vedoucích. Dodio hlídá limit, čerpání i schválení, aby benefit fungoval férově pro všechny."
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
          heading="Udělejte ze sick days skutečný benefit"
          body="Limit, čerpání i schvalování na jednom místě, odděleně od nemocenské. Zdarma do 5 lidí, bez platební karty."
        />

        <PageFaq heading="Časté dotazy k sick days" items={FAQ_ITEMS} />

        <RelatedLinks links={[{ label: "Evidence absencí zaměstnanců", href: "/evidence-absenci" }]} />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
