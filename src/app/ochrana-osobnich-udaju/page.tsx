import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů – Dodio",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main className="flex-1">
        <Container className="flex flex-col gap-6 py-16">
          <h1 className="m-0 font-dodio-display text-4xl font-extrabold">Ochrana osobních údajů</h1>
          <p className="m-0 text-dodio-ink-muted">[Text ochrany osobních údajů bude doplněn.]</p>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
