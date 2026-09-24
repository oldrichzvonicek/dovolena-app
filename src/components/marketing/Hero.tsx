import { Container } from "./Container";
import { CheckIcon } from "./icons";
import { DodioMark } from "./DodioLogo";
import { DEMO_URL, SIGNUP_URL } from "@/lib/dodio-links";

const BENEFITS = ["Celé v češtině", "Zdarma do 5 lidí", "Exporty pro Pohodu"];

function ApprovalChatCard({ className = "" }: { className?: string }) {
  // Illustrative app preview, not a real control surface — the whole card
  // is decorative, so it's hidden from assistive tech and uses non-focusable
  // markup instead of real buttons/links (per the interactivity spec).
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col gap-3.5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_24px_48px_-20px_rgba(44,44,42,0.30)] ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <DodioMark size={28} />
        <div className="text-sm font-semibold">
          Dodio <span className="font-normal text-dodio-ink-muted">· ve Slacku a Teams</span>
        </div>
      </div>
      <div className="text-[15px] leading-[22px]">
        <strong className="font-semibold">Petra Horáková</strong> žádá o dovolenou
        <br />
        <span className="text-dodio-ink-muted">Čt 29. – Pá 30. října · 2 dny</span>
      </div>
      <div className="flex gap-2">
        <span className="flex h-11 flex-1 items-center justify-center rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white">
          Schválit
        </span>
        <span className="flex h-11 flex-1 items-center justify-center rounded-dodio-md border border-dodio-border text-sm font-semibold text-dodio-danger-dark">
          Zamítnout
        </span>
      </div>
    </div>
  );
}

function OverviewCard() {
  const outToday = [
    { initials: "MS", bg: "bg-[#FBE4DA]", fg: "text-dodio-coral-dark", name: "Martin Svoboda", detail: "Nemoc · do úterý" },
    { initials: "TD", bg: "bg-[#ECEAE3]", fg: "text-dodio-ink", name: "Tomáš Dvořák", detail: "Home office · celý den" },
    { initials: "LČ", bg: "bg-[#E3F2EC]", fg: "text-dodio-teal-dark", name: "Lucie Černá", detail: "Lékař · 8:00–11:00" },
  ];

  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[520px] flex-col gap-5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-7 shadow-[0_24px_48px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="flex items-center justify-between">
        <div className="font-dodio-display text-xl font-bold">Můj přehled</div>
        <span className="flex items-center gap-1.5 rounded-dodio-md bg-dodio-coral px-3.5 py-2.5 text-sm font-semibold text-dodio-coral-dark">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="#712B13" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nová žádost
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-dodio-md bg-[#E3F2EC] p-3.5">
          <div className="font-dodio-display text-3xl font-extrabold text-dodio-teal-dark">14</div>
          <div className="text-xs font-medium text-dodio-teal-dark">dní dovolené zbývá</div>
        </div>
        <div className="rounded-dodio-md bg-dodio-surface p-3.5">
          <div className="font-dodio-display text-3xl font-extrabold text-dodio-ink">3</div>
          <div className="text-xs font-medium text-dodio-ink-muted">sick days zbývají</div>
        </div>
        <div className="rounded-dodio-md bg-[#FDF1DE] p-3.5">
          <div className="font-dodio-display text-3xl font-extrabold text-dodio-warning-dark">1</div>
          <div className="text-xs font-medium text-dodio-warning-dark">žádost čeká</div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="pb-1.5 text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">Dnes chybí</div>
        {outToday.map((person) => (
          <div key={person.initials} className="flex items-center gap-3 border-t border-[#EFEDE6] py-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${person.bg} ${person.fg}`}>
              {person.initials}
            </div>
            <div className="flex-1">
              <div className="text-[15px] font-medium">{person.name}</div>
              <div className="text-[13px] text-dodio-ink-muted">{person.detail}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-dodio-sm bg-[#E3F2EC] px-2 py-1 text-xs font-medium text-dodio-teal-dark">
              <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal" />
              Schváleno
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="font-dodio-sans">
      <Container className="grid grid-cols-1 items-center gap-12 py-14 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-6 lg:gap-7">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#E3F2EC] px-3 py-1.5 text-xs font-semibold text-dodio-teal-dark lg:text-[13px]">
            <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal lg:h-2 lg:w-2" />
            Pro malé a střední české firmy
          </div>
          <h1 className="m-0 font-dodio-display text-[40px] font-extrabold leading-[44px] tracking-[-1px] text-dodio-ink lg:text-[68px] lg:leading-[72px] lg:tracking-[-2px]">
            Dovolená bez tabulek a e‑mailů.
          </h1>
          <p className="m-0 max-w-[540px] text-[17px] leading-[26px] text-dodio-ink-muted lg:text-xl lg:leading-[30px]">
            Žádost za tři kliknutí, schválení přímo ve Slacku nebo Teams a podklady pro mzdy jedním
            exportem. Dodio hlídá zůstatky, české svátky i to, kdo dnes chybí.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <a
              href={SIGNUP_URL}
              className="w-full rounded-dodio-md bg-dodio-teal-dark px-6 py-4 text-center text-base font-semibold text-white no-underline hover:bg-dodio-teal sm:w-auto lg:px-[26px] lg:py-4 lg:text-[17px]"
            >
              Vyzkoušet zdarma
            </a>
            <a
              href={DEMO_URL}
              className="w-full rounded-dodio-md border border-dodio-border bg-dodio-surface-card px-6 py-3.5 text-center text-base font-semibold text-dodio-ink no-underline sm:w-auto lg:px-6 lg:py-[15px] lg:text-[17px]"
            >
              Ukázat demo
            </a>
          </div>
          <div className="hidden flex-wrap gap-6 text-sm text-dodio-ink-muted lg:flex">
            {BENEFITS.map((benefit) => (
              <span key={benefit} className="flex items-center gap-2">
                <CheckIcon />
                {benefit}
              </span>
            ))}
          </div>
        </div>

        {/* Mobile: only the chat approval card, per spec */}
        <div className="lg:hidden">
          <ApprovalChatCard />
        </div>

        {/* Desktop: overview card + overlapping chat approval card */}
        <div className="relative hidden h-[560px] lg:block">
          <div className="absolute right-0 top-0">
            <OverviewCard />
          </div>
          <ApprovalChatCard className="absolute bottom-0 left-0 w-[360px]" />
        </div>
      </Container>
    </section>
  );
}
