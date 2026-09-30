import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { ContactForm } from "@/components/marketing/ContactForm";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

const TITLE = "Kontakt – Dodio";
const DESCRIPTION = "Napište nám nebo si najděte fakturační a firemní údaje Dodio.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://dodio.cz/kontakt" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://dodio.cz/kontakt",
    siteName: "Dodio",
    locale: "cs_CZ",
  },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-16">
          <h1 className="m-0 font-dodio-display text-4xl font-extrabold">Kontakt</h1>
          <p className="m-0 mt-3 max-w-[560px] text-[15px] leading-[24px] text-dodio-ink-muted">
            Máte dotaz k Dodio, potřebujete poradit s nastavením nebo řešíte něco jiného? Napište nám přes
            formulář nebo rovnou na e-mail — ozveme se co nejdřív.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h2 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink">Přímý kontakt</h2>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-[15px] font-medium text-dodio-teal-dark no-underline hover:underline"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>

              <div className="flex flex-col gap-2 border-t border-dodio-border pt-6">
                <h2 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink">Fakturační a firemní údaje</h2>
                <div className="flex flex-col gap-0.5 text-[15px] leading-[24px] text-dodio-ink-muted">
                  <div className="font-semibold text-dodio-ink">Vinyl Garden s.r.o.</div>
                  <div>Zavadilka 2036, 370 05 České Budějovice</div>
                  <div>IČO: 21984697</div>
                  <div className="mt-2 text-sm">
                    Zapsaná v obchodním rejstříku vedeném u Krajského soudu v Českých Budějovicích pod
                    spisovou značkou C 34524.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border bg-white p-6 lg:p-8">
              <h2 className="m-0 font-dodio-display text-lg font-bold text-dodio-ink">Napište nám</h2>
              <ContactForm />
            </div>
          </div>
        </Container>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
