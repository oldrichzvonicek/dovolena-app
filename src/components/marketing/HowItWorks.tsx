import { Container } from "./Container";

const STEPS = ["Zaměstnanec požádá", "Vedoucí schválí", "Tým má přehled"];

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path
        d="M4 10h11M10 5l5 5-5 5"
        fill="none"
        stroke="#5F5E5A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col items-center gap-4 py-8 lg:py-10">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
          Jak Dodio funguje
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dodio-teal-dark font-dodio-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-dodio-display text-base font-bold text-dodio-ink lg:text-lg">{step}</span>
              </div>
              {i < STEPS.length - 1 && (
                <Arrow className="hidden shrink-0 sm:block" />
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
