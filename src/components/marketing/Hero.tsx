import { Fragment } from "react";
import { Container } from "./Container";
import { CheckIcon } from "./icons";
import { DodioMark } from "./DodioLogo";
import { SIGNUP_URL } from "@/lib/dodio-links";

const BENEFITS = ["Čeština", "Česká pravidla", "Exporty"];

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
          dodio <span className="font-normal text-dodio-ink-muted">· ke schválení</span>
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

interface BalanceTile {
  label: string;
  badge?: string;
  value: string;
  unit: string;
  usedPct?: number;
  plannedPct?: number;
  caption: string;
  note?: string;
}

const BALANCE_TILES: BalanceTile[] = [
  {
    label: "Dovolená",
    badge: "Dochází",
    value: "4,5",
    unit: "dne zbývá",
    usedPct: 16,
    plannedPct: 66,
    caption: "Čerpáno 4 · Naplánováno 16,5",
  },
  {
    label: "Sick Days",
    value: "6",
    unit: "dní zbývá",
    usedPct: 0,
    plannedPct: 0,
    caption: "Čerpáno 0 · Naplánováno 0",
  },
  {
    label: "Home Office letos",
    value: "22",
    unit: "dní letos",
    caption: "Čerpáno 4 · Naplánováno 18",
    note: "bez limitu",
  },
];

function BalanceCard({ tile }: { tile: BalanceTile }) {
  const hasBar = tile.usedPct !== undefined;
  return (
    <div className="flex flex-col gap-1.5 rounded-dodio-md bg-dodio-surface p-3.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-dodio-ink-muted">{tile.label}</span>
        {tile.badge && (
          <span className="rounded-dodio-sm bg-[#FDF1DE] px-1.5 py-0.5 text-[10px] font-semibold text-dodio-warning-dark">
            {tile.badge}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-dodio-display text-2xl font-extrabold text-dodio-ink">{tile.value}</span>
        <span className="text-[11px] text-dodio-ink-muted">{tile.unit}</span>
      </div>
      {hasBar && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-dodio-border/50">
          <div className="h-full bg-dodio-teal-dark" style={{ width: `${tile.usedPct}%` }} />
          <div className="h-full bg-dodio-teal" style={{ width: `${tile.plannedPct}%` }} />
        </div>
      )}
      <div className="text-[10px] leading-[14px] text-dodio-ink-muted">
        {tile.caption}
        {tile.note && <span> · {tile.note}</span>}
      </div>
    </div>
  );
}

const WEEK_DAYS = [
  { label: "Po 28." },
  { label: "Út 29." },
  { label: "St 30.", today: true },
  { label: "Čt 1." },
  { label: "Pá 2." },
];

interface WeekRow {
  name: string;
  cells: (string | null)[];
}

const WEEK_ROWS: WeekRow[] = [
  { name: "Martin Svoboda", cells: [null, null, "bg-dodio-danger", null, null] },
  { name: "Lucie Černá", cells: [null, null, null, "bg-[#4A7FC9]", "bg-[#4A7FC9]"] },
];

function OverviewCard() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[520px] flex-col gap-5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-7 shadow-[0_24px_48px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="flex items-center justify-between">
        <div className="font-dodio-display text-xl font-bold">Můj přehled</div>
        <span className="flex items-center gap-1.5 rounded-dodio-md bg-dodio-teal-dark px-3.5 py-2.5 text-sm font-semibold text-white">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nová žádost
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="ml-0.5">
            <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {BALANCE_TILES.map((tile) => (
          <BalanceCard key={tile.label} tile={tile} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
            Kdo tento týden chybí
          </div>
          <span className="rounded-dodio-sm bg-[#FBE4DA] px-2 py-0.5 text-[10px] font-semibold text-dodio-coral-dark">
            V práci 3 ze 4
          </span>
        </div>
        <div className="grid grid-cols-[128px_repeat(5,1fr)] items-center gap-x-1 gap-y-1.5">
          <div />
          {WEEK_DAYS.map((day) => (
            <div
              key={day.label}
              className={`rounded-dodio-sm py-1 text-center text-[10px] font-medium ${
                day.today ? "bg-[#E3F2EC] text-dodio-teal-dark" : "text-dodio-ink-muted"
              }`}
            >
              {day.label}
            </div>
          ))}
          {WEEK_ROWS.map((row) => (
            <Fragment key={row.name}>
              <div className="truncate pr-2 text-[13px] font-medium text-dodio-ink">{row.name}</div>
              {row.cells.map((cell, i) => (
                <div key={i} className={`h-5 rounded-dodio-sm ${cell ?? "bg-dodio-border/40"}`} />
              ))}
            </Fragment>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] text-dodio-ink-muted">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2.5 rounded-[2px] bg-dodio-danger" />
            Sick Day
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2.5 rounded-[2px] bg-[#4A7FC9]" />
            Home Office
          </span>
        </div>
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
            Absence bez tabulek, e-mailů a administrativy.
          </h1>
          <p className="m-0 max-w-[540px] text-[17px] leading-[26px] text-dodio-ink-muted lg:text-xl lg:leading-[30px]">
            Dodio sjednotí žádosti o dovolenou, schvalování a přehled absencí na jednom místě.
          </p>
          <div className="flex flex-col gap-2.5">
            <a
              href={SIGNUP_URL}
              className="w-full rounded-dodio-md bg-dodio-teal-dark px-6 py-4 text-center text-base font-semibold text-white no-underline hover:bg-dodio-teal sm:w-auto lg:px-[26px] lg:py-4 lg:text-[17px]"
            >
              Vyzkoušet zdarma
            </a>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-dodio-ink-muted">
              <span>Bez platební karty</span>
              <span aria-hidden="true">·</span>
              <span>Nastavení za pár minut</span>
            </div>
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
