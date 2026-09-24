import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Footer } from "@/components/marketing/Footer";
import { Container } from "@/components/marketing/Container";

export const metadata: Metadata = {
  title: "Obchodní podmínky – Dodio",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-dodio-surface font-dodio-sans text-dodio-ink">
      <SiteHeader />
      <main className="flex-1">
        <Container className="flex flex-col gap-6 py-16">
          <h1 className="m-0 font-dodio-display text-4xl font-extrabold">Obchodní podmínky</h1>
          <p className="m-0 text-dodio-ink-muted">[Text obchodních podmínek bude doplněn.]</p>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
