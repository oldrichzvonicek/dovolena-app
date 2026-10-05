import { Container } from "./Container";
import { SIGNUP_URL } from "@/lib/dodio-links";

/** Teal CTA band reused across standalone content pages. */
export function PageCta({
  heading,
  body,
  ctaLabel = "Vyzkoušet Dodio zdarma",
  ctaHref = SIGNUP_URL,
}: {
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <section className="bg-dodio-teal-dark">
      <Container className="flex flex-col gap-4 py-14 text-center lg:py-16">
        <h2 className="m-0 font-dodio-display text-2xl font-extrabold text-white lg:text-[32px] lg:leading-[38px]">
          {heading}
        </h2>
        <p className="m-0 mx-auto max-w-[560px] text-[15px] leading-[23px] text-[#D7EEE6] lg:text-lg lg:leading-[28px]">
          {body}
        </p>
        <div className="pt-2">
          <a
            href={ctaHref}
            className="inline-block rounded-dodio-md bg-dodio-coral px-7 py-3.5 text-base font-bold text-dodio-coral-dark no-underline"
          >
            {ctaLabel}
          </a>
        </div>
      </Container>
    </section>
  );
}
