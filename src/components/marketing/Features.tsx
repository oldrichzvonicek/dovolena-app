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
      className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_20px_40px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Nová žádost</span>
        <span className="rounded-dodio-sm bg-[#E3F2EC] px-2 py-1 text-xs font-medium text-dodio-teal-dark">Dovolená</span>
      </div>
      <div className="text-[13px] text-dodio-ink-muted">Čt 29. – Pá 30. října · 2 dny</div>
      <div className="h-px bg-dodio-border" />
      <div className="flex items-center justify-between text-sm">
        <span className="text-dodio-ink-muted">Zůstatek po žádosti</span>
        <span className="font-semibold">14,5 dne</span>
      </div>
      <span className="flex h-10 items-center justify-center rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white">
        Odeslat ke schválení
      </span>
    </div>
  );
}

function ApprovalIllustration() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full max-w-[380px] flex-col gap-3.5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 shadow-[0_20px_40px_-24px_rgba(44,44,42,0.25)]"
    >
      <div className="text-[15px] leading-[22px]">
        <strong className="font-semibold">Tomáš Dvořák</strong> žádá o dovolenou
        <br />
        <span className="text-dodio-ink-muted">Po 12. – Pá 16. ledna · 5 dní</span>
      </div>
      <div className="flex items-start gap-2 rounded-dodio-md bg-[#FDF1DE] px-3 py-2.5 text-xs font-medium leading-[17px] text-dodio-warning-dark">
        <svg width="14" height="14" viewBox="0 0 14 14" className="mt-0.5 shrink-0">
          <path d="M7 1L13 12H1L7 1z" fill="#EF9F27" />
          <rect x="6.25" y="5" width="1.5" height="3.5" fill="#7A4E11" />
          <rect x="6.25" y="9.3" width="1.5" height="1.5" fill="#7A4E11" />
        </svg>
        V tomto týdnu bude mimo už 3 z 8 lidí v týmu.
      </div>
      <div className="flex gap-2">
        <span className="flex h-10 flex-1 items-center justify-center rounded-dodio-md bg-dodio-teal-dark text-sm font-semibold text-white">
          Schválit
        </span>
        <span className="flex h-10 flex-1 items-center justify-center rounded-dodio-md border border-dodio-border text-sm font-semibold text-dodio-danger-dark">
          Zamítnout
        </span>
      </div>
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
            Pro koho appka je
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
              "Chytré návrhy appky, kdy si vzít pár dní navíc kolem svátku a mít dlouhé volno.",
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
              "Schválení jedním kliknutím přímo z e-mailu, bez přihlašování do appky.",
              "Kapacitní varování — appka upozorní, než by schválení nechalo tým pod minimem lidí.",
              "Přehled absencí celého týmu v kalendáři, včetně zástupů.",
              "Zástupce pro dobu vlastní nepřítomnosti, ať schvalování nestoí.",
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
