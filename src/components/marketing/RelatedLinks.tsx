import { Container } from "./Container";

interface RelatedLink {
  label: string;
  href: string;
}

/** Small "related pages" block for internal linking between content pages. */
export function RelatedLinks({ links }: { links: RelatedLink[] }) {
  return (
    <section className="border-t border-dodio-border bg-dodio-surface-card">
      <Container className="flex flex-col gap-3 py-10 lg:flex-row lg:items-center lg:gap-6 lg:py-12">
        <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">Související stránky</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-dodio-teal-dark no-underline hover:underline"
            >
              {link.label} →
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
