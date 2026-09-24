import { Container } from "./Container";
import { SIGNUP_URL } from "@/lib/dodio-links";

export function FinalCTA() {
  return (
    <section className="font-dodio-sans">
      <Container className="pb-14 lg:pb-[112px]">
        <div className="relative flex flex-col gap-5 overflow-hidden rounded-dodio-xl bg-dodio-teal-dark p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:p-[72px_80px]">
          <svg
            width="220"
            height="220"
            viewBox="0 0 220 220"
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-16"
          >
            <circle cx="110" cy="110" r="110" fill="#0F9D7C" opacity="0.35" />
          </svg>
          <div className="relative flex flex-col gap-3.5 lg:gap-3.5">
            <h2 className="m-0 max-w-[640px] font-dodio-display text-[30px] font-extrabold leading-[36px] text-white lg:text-[48px] lg:leading-[54px] lg:tracking-[-1px]">
              Příští dovolenou schválíte za minutu.
            </h2>
            <p className="m-0 hidden text-lg leading-[28px] text-[#D7EEE6] lg:block">
              Založte firmu, pozvěte tým a první žádost může odejít ještě dnes.
            </p>
          </div>
          <a
            href={SIGNUP_URL}
            className="relative shrink-0 rounded-dodio-md bg-dodio-coral px-7 py-4 text-center text-base font-bold text-dodio-coral-dark no-underline lg:px-[30px] lg:py-[18px] lg:text-lg"
          >
            Vyzkoušet zdarma
          </a>
        </div>
      </Container>
    </section>
  );
}
