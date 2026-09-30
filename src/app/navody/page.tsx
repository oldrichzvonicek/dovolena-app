import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";
import { CookieBanner } from "@/components/marketing/CookieBanner";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

export const metadata: Metadata = {
  title: "Návody – Dodio",
};

export default function GuidesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main className="flex-1">
        <Container className="flex flex-col gap-6 py-16">
          <h1 className="m-0 font-dodio-display text-4xl font-extrabold">Návody</h1>
          <p className="m-0 text-dodio-ink-muted">
            Návody na Dodio připravujeme. Pokud si nevíte s něčím rady už teď, napište nám na{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-dodio-teal-dark underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Container>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
