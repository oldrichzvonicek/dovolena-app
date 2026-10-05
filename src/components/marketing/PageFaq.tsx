import type { ReactNode } from "react";
import { Container } from "./Container";

interface FaqItem {
  q: string;
  /** Plain-text answer, also used verbatim in the FAQPage JSON-LD. */
  a: string;
  /** Optional rendered override (e.g. with an inline link) — JSON-LD still uses `a`. */
  node?: ReactNode;
}

/**
 * FAQ block for standalone content pages (not the homepage's own FAQ
 * section). Renders the same <details> UI as the homepage FAQ, plus a
 * FAQPage JSON-LD block so each page can carry its own rich-result markup.
 */
export function PageFaq({ heading, items }: { heading: string; items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section>
      <Container className="flex flex-col gap-6 py-14 lg:py-20">
        <h2 className="m-0 font-dodio-display text-2xl font-extrabold lg:text-[32px] lg:leading-[38px]">
          {heading}
        </h2>
        <div className="flex flex-col">
          {items.map((item, i) => (
            <details key={item.q} className={`border-t border-dodio-border py-5 ${i === items.length - 1 ? "border-b" : ""}`}>
              <summary className="cursor-pointer font-dodio-display text-lg font-bold">{item.q}</summary>
              <p className="m-0 mt-3 text-[15px] leading-[24px] text-dodio-ink-muted">{item.node ?? item.a}</p>
            </details>
          ))}
        </div>
      </Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
