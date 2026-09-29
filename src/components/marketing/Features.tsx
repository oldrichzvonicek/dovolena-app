import type { ReactNode } from "react";
import { Container } from "./Container";
import { CheckIcon, EmployeeIcon, ManagerIcon, HRIcon } from "./icons";

interface PersonaCardProps {
  iconBg: string;
  icon: ReactNode;
  title: string;
  points: string[];
}

function PersonaCard({ iconBg, icon, title, points }: PersonaCardProps) {
  return (
    <div className="flex flex-col gap-5 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:gap-6 lg:p-8">
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          <PersonaCard
            iconBg="bg-[#E3F2EC]"
            icon={<EmployeeIcon />}
            title="Zaměstnanec"
            points={[
              "Žádost o dovolenou na pár kliknutí — typ, termín, případně zástup za sebe, odeslat.",
              "Naplánovat si rok dopředu soukromě, bez odesílání ke schválení, a pak žádost podat jedním kliknutím.",
              "Zůstatek na první pohled — čerpáno, naplánováno, zbývá.",
              "Chytré návrhy appky, kdy si vzít pár dní navíc kolem svátku a mít dlouhé volno.",
              "Soukromí nemoci — kolegové vidí jen „Nepřítomen“, typ absence jen nadřízený a HR.",
            ]}
          />
          <PersonaCard
            iconBg="bg-[#FBE4DA]"
            icon={<ManagerIcon />}
            title="Manažer"
            points={[
              "Schválení jedním klikem přímo z e-mailu, bez přihlašování do appky.",
              "Kapacitní varování — appka upozorní, než by schválení nechalo tým pod minimem lidí.",
              "Přehled absencí celého týmu v kalendáři, včetně zástupů.",
              "Zástupce pro dobu vlastní nepřítomnosti, ať schvalování nestojí.",
            ]}
          />
          <PersonaCard
            iconBg="bg-[#ECEAE3]"
            icon={<HRIcon />}
            title="HR & Admin"
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
