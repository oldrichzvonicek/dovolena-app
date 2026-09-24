import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { TodayVsDodio } from "@/components/marketing/TodayVsDodio";
import { BuiltForCzechiaCompact } from "@/components/marketing/BuiltForCzechiaCompact";
import { Features } from "@/components/marketing/Features";
import { TeamCalendar } from "@/components/marketing/TeamCalendar";
import { Integrations } from "@/components/marketing/Integrations";
import { Pricing } from "@/components/marketing/Pricing";
import { FAQ } from "@/components/marketing/FAQ";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { Footer } from "@/components/marketing/Footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface text-dodio-ink">
      <SiteHeader />
      <main>
        <Hero />
        <TodayVsDodio />
        <BuiltForCzechiaCompact />
        <Features />
        <TeamCalendar />
        <Integrations />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
