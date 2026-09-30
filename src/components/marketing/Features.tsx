import type { ReactNode } from "react";
import { Container } from "./Container";
import { CheckIcon, EmployeeIcon, ManagerIcon, HRIcon } from "./icons";

// Illustrative mini app-previews, not real screenshots — same decorative,
// aria-hidden, non-focusable convention used in Hero's overview/approval
// cards, sized to sit next to persona text instead of behind more bullets.

function RequestIllustration() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[380px] flex-col gap-3 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_20px_40px_-24px_rgba(44,44,42,0.25)]"
    >
      <span className="text-sm font-semibold">Nová žádost o absenci</span>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-dodio-ink-muted">Typ absence</span>
        <span className="flex items-center justify-between rounded-dodio-md border border-dodio-border px-3 py-2 text-sm">
          Dovolená
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="#5F5E5A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-dodio-ink-muted">Délka trvání</span>
        <div className="flex rounded-dodio-md bg-dodio-surface p-1 text-xs font-semibold">
          <span className="flex-1 rounded-dodio-sm bg-white py-1.5 text-center text-dodio-ink shadow-[0_1px_3px_rgba(44,44,42,0.15)]">
            Celý den
          </span>
          <span className="flex-1 py-1.5 text-center text-dodio-ink-muted">Půlden</span>
          <span className="flex-1 py-1.5 text-center text-dodio-ink-muted">Hodiny</span>
        </div>
      </div>
      <div className="text-[13px] text-dodio-ink-muted">7. – 9. října 2026</div>
      <div className="rounded-dodio-md bg-[#E3F2EC] px-3 py-2 text-[12px] leading-[17px] text-dodio-teal-dark">
        Celkem: 3 pracovní dny — víkendy a státní svátky odečteny automaticky.
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-dodio-ink-muted">Poznámka pro manažera (volitelné)</span>
        <span className="text-[11px] italic text-dodio-ink-muted/80">Neuvádějte zdravotní údaje.</span>
      </div>
      <span className="flex h-10 items-center justify-center rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white">
        Odeslat ke schválení
      </span>
    </div>
  );
}

function ApprovalIllustration() {
  const items = [
    { name: "Tomáš Dvořák", range: "7. – 9. října 2026" },
    { name: "Lucie Černá", range: "20. – 22. října 2026" },
  ];
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[380px] flex-col gap-3 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_20px_40px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        Čeká na vaše schválení
        <span className="rounded-dodio-sm bg-dodio-coral px-1.5 py-0.5 text-[11px] font-bold text-dodio-coral-dark">
          {items.length}
        </span>
      </div>
      {items.map((item) => (
        <div key={item.name} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFEDE6] pt-3">
          <div className="text-[13px]">
            <div className="font-medium">{item.name} – Dovolená</div>
            <div className="text-dodio-ink-muted">{item.range}</div>
          </div>
          <div className="flex gap-1.5">
            <span className="flex h-8 items-center justify-center rounded-dodio-sm bg-dodio-teal-dark px-2.5 text-xs font-semibold text-white">
              Schválit
            </span>
            <span className="flex h-8 items-center justify-center rounded-dodio-sm border border-dodio-border px-2.5 text-xs font-semibold text-dodio-danger-dark">
              Zamítnout
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExportIllustration() {
  const rows = [
    { name: "Alena Králová", days: "2 dny" },
    { name: "Ondřej Veselý", days: "1 den" },
    { name: "Veronika Sedláková", days: "0,5 dne" },
  ];
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_20px_40px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="text-sm font-semibold">Export pro mzdy — říjen 2026</div>
      <div className="flex flex-col">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between border-t border-[#EFEDE6] py-2 text-[13px]">
            <span>{row.name}</span>
            <span className="text-dodio-ink-muted">{row.days}</span>
          </div>
        ))}
      </div>
      <span className="flex h-10 items-center justify-center gap-2 rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white">
        Stáhnout CSV
      </span>
    </div>
  );
}

interface PersonaRowProps {
  iconBg: string;
  icon: ReactNode;
  title: string;
  points: string[];
  illustration: ReactNode;
  reverse?: boolean;
}

function PersonaRow({ iconBg, icon, title, points, illustration, reverse }: PersonaRowProps) {
  return (
    <div
      className={`flex flex-col items-center gap-8 lg:gap-14 ${
        reverse ? "lg:flex-row-reverse" : "lg:flex-row"
      }`}
    >
      <div className="flex w-full justify-center lg:w-1/2 lg:justify-start">{illustration}</div>
      <div className="flex w-full flex-col gap-5 lg:w-1/2">
        <div className="flex items-center gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] lg:h-[52px] lg:w-[52px] lg:rounded-xl ${iconBg}`}>
            <div className="h-[22px] w-[22px] lg:h-[26px] lg:w-[26px]">{icon}</div>
          </div>
          <h3 className="m-0 font-dodio-display text-[19px] font-bold lg:text-[22px]">{title}</h3>
        </div>
        <div className="flex flex-col gap-3">
          {points.map((point) => (
            <div key={point} className="flex items-start gap-2.5">
              <span className="mt-1 shrink-0">
                <CheckIcon />
              </span>
              <span className="text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                {point}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="funkce" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-12 lg:pb-[120px]">
        <div className="flex max-w-[720px] flex-col gap-3.5 lg:gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Pro koho je Dodio
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Řeší to pro každého v týmu.
          </h2>
        </div>
        <div className="flex flex-col gap-16 lg:gap-24">
          <PersonaRow
            iconBg="bg-[#E3F2EC]"
            icon={<EmployeeIcon />}
            title="Zaměstnanec"
            illustration={<RequestIllustration />}
            points={[
              "Žádost o dovolenou na pár kliknutí — typ, termín, případně zástup za sebe, odeslat.",
              "Naplánovat si rok dopředu soukromě, bez odesílání ke schválení, a pak žádost podat jedním kliknutím.",
              "Zůstatek na první pohled — čerpáno, naplánováno, zbývá.",
              "Chytré návrhy Dodia, kdy si vzít pár dní navíc kolem svátku a mít dlouhé volno.",
              "Soukromí nemoci — kolegové vidí jen „Nepřítomen“, typ absence jen nadřízený a HR.",
            ]}
          />
          <PersonaRow
            iconBg="bg-[#FBE4DA]"
            icon={<ManagerIcon />}
            title="Manažer"
            illustration={<ApprovalIllustration />}
            reverse
            points={[
              "Schválení absence na dvě kliknutí.",
              "Kapacitní varování — Dodio upozorní, než by schválení nechalo tým pod minimem lidí.",
              "Přehled absencí celého týmu v kalendáři, včetně zástupů.",
              "Zástupce pro dobu vlastní nepřítomnosti, ať schvalování nestojí.",
            ]}
          />
          <PersonaRow
            iconBg="bg-[#ECEAE3]"
            icon={<HRIcon />}
            title="HR & Admin"
            illustration={<ExportIllustration />}
            points={[
              "Vlastní typy absencí a pravidla čerpání přesně podle vaší firmy.",
              "Import zaměstnanců a hromadné akce — rozjezd za minuty, ne za týdny.",
              "Podklady pro mzdy jedním exportem, bez ručního sbírání.",
              "Role HR zdarma na jakémkoli tarifu, Účetní jako doplněk — každý vidí jen to, co má.",
            ]}
          />
        </div>
      </Container>
    </section>
  );
}
