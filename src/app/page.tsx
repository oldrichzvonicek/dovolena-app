import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { AbsenceTypeTabs } from "@/components/marketing/AbsenceTypeTabs";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { Features } from "@/components/marketing/Features";
import { TeamCalendar } from "@/components/marketing/TeamCalendar";
import { SmartHR } from "@/components/marketing/SmartHR";
import { Integrations } from "@/components/marketing/Integrations";
import { Security } from "@/components/marketing/Security";
import { ChooseYourPath } from "@/components/marketing/ChooseYourPath";
import { Pricing } from "@/components/marketing/Pricing";
import { LeadMagnet } from "@/components/marketing/LeadMagnet";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";
import { CookieBanner } from "@/components/marketing/CookieBanner";

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Dodio",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://dodio.cz",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "CZK",
  },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface text-dodio-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <AbsenceTypeTabs />
        <HowItWorks />
        <Features />
        <ProblemSolution />
        <Integrations />
        <TeamCalendar />
        <SmartHR />
        <Security />
        <ChooseYourPath />
        <Pricing />
        <LeadMagnet />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
