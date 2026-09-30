import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { Features } from "@/components/marketing/Features";
import { ProductPreview } from "@/components/marketing/ProductPreview";
import { TeamCalendar } from "@/components/marketing/TeamCalendar";
import { SmartHR } from "@/components/marketing/SmartHR";
import { Integrations } from "@/components/marketing/Integrations";
import { Security } from "@/components/marketing/Security";
import { Pricing } from "@/components/marketing/Pricing";
import { LeadMagnet } from "@/components/marketing/LeadMagnet";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";
import { CookieBanner } from "@/components/marketing/CookieBanner";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface text-dodio-ink">
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <ProductPreview />
        <ProblemSolution />
        <TeamCalendar />
        <SmartHR />
        <Integrations />
        <Security />
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
