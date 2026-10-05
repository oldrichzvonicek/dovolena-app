import type { ReactNode } from "react";
import { Container } from "./Container";
import { SIGNUP_URL } from "@/lib/dodio-links";

interface CtaLink {
  label: string;
  href: string;
}

/** Simple eyebrow + H1 + perex + CTA hero, reused across standalone content pages. */
export function PageHero({
  eyebrow,
  h1,
  perex,
  primaryCta = { label: "Vyzkoušet zdarma", href: SIGNUP_URL },
  secondaryCta,
  children,
}: {
  eyebrow: string;
  h1: string;
  perex: string;
  primaryCta?: CtaLink;
  secondaryCta?: CtaLink;
  children?: ReactNode;
}) {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-6 py-14 lg:gap-7 lg:py-20">
        <div className="flex max-w-[680px] flex-col gap-5 lg:gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#E3F2EC] px-3 py-1.5 text-xs font-semibold text-dodio-teal-dark lg:text-[13px]">
            <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal lg:h-2 lg:w-2" />
            {eyebrow}
          </div>
          <h1 className="m-0 font-dodio-display text-[34px] font-extrabold leading-[40px] tracking-[-0.5px] text-dodio-ink lg:text-[52px] lg:leading-[56px] lg:tracking-[-1px]">
            {h1}
          </h1>
          <p className="m-0 max-w-[560px] text-[17px] leading-[26px] text-dodio-ink-muted">{perex}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={primaryCta.href}
              className="rounded-dodio-md bg-dodio-teal-dark px-6 py-4 text-center text-base font-semibold text-white no-underline hover:bg-dodio-teal"
            >
              {primaryCta.label}
            </a>
            {secondaryCta && (
              <a
                href={secondaryCta.href}
                className="rounded-dodio-md border border-dodio-border px-6 py-4 text-center text-base font-semibold text-dodio-ink no-underline hover:bg-dodio-surface-card"
              >
                {secondaryCta.label}
              </a>
            )}
          </div>
          <span className="text-[13px] text-dodio-ink-muted">Do 5 lidí zdarma. Bez platební karty.</span>
        </div>
        {children}
      </Container>
    </section>
  );
}
