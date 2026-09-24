import type { ReactNode } from "react";
import { Container } from "./Container";
import { RequestIcon, ChatApprovalIcon, TeamCalendarIcon, ExportIcon } from "./icons";

interface FeatureCardProps {
  iconBg: string;
  icon: ReactNode;
  titleDesktop: string;
  titleMobile?: string;
  bodyDesktop: string;
  bodyMobile: string;
}

function FeatureCard({ iconBg, icon, titleDesktop, titleMobile, bodyDesktop, bodyMobile }: FeatureCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-5 lg:gap-4 lg:p-9">
      <div className={`flex h-11 w-11 items-center justify-center rounded-[10px] lg:h-[52px] lg:w-[52px] lg:rounded-xl ${iconBg}`}>
        <div className="h-[22px] w-[22px] lg:h-[26px] lg:w-[26px]">{icon}</div>
      </div>
      <h3 className="m-0 font-dodio-display text-[19px] font-bold lg:text-[22px]">
        {titleMobile ? (
          <>
            <span className="lg:hidden">{titleMobile}</span>
            <span className="hidden lg:inline">{titleDesktop}</span>
          </>
        ) : (
          titleDesktop
        )}
      </h3>
      <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
        <span className="lg:hidden">{bodyMobile}</span>
        <span className="hidden lg:inline">{bodyDesktop}</span>
      </p>
    </div>
  );
}

export function Features() {
  return (
    <section id="funkce" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-12 lg:pb-[120px]">
        <div className="flex max-w-[720px] flex-col gap-3.5 lg:gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">Funkce</div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            <span className="lg:hidden">Nic, co byste museli školit.</span>
            <span className="hidden lg:inline">Všechno, co potřebujete. Nic, co byste museli školit.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <FeatureCard
            iconBg="bg-[#FBE4DA]"
            icon={<RequestIcon />}
            titleDesktop="Žádost za tři kliknutí"
            bodyDesktop="Typ absence, termín, odeslat. Zaměstnanec hned vidí, kolik dní mu zbývá – bez dotazů na účetní a bez hledání v tabulce."
            bodyMobile="Typ, termín, odeslat. Zůstatek vidí každý hned."
          />
          <FeatureCard
            iconBg="bg-[#E3F2EC]"
            icon={<ChatApprovalIcon />}
            titleDesktop="Schválení tam, kde tým pracuje"
            titleMobile="Schválení ve Slacku a Teams"
            bodyDesktop="Manažer schválí nebo zamítne jedním tlačítkem přímo ve Slacku či Microsoft Teams. Kdo chce, má na webu přehledné centrum schvalování."
            bodyMobile="Manažer klikne na tlačítko přímo v chatu."
          />
          <FeatureCard
            iconBg="bg-[#E3F2EC]"
            icon={<TeamCalendarIcon />}
            titleDesktop="Kdo dnes chybí? Víte v 8:00."
            bodyDesktop="Týmový kalendář ukáže absence celé firmy na jednom místě. Každé ráno přijde souhrn do chatu a vše se propíše do Outlooku či Google Kalendáře."
            bodyMobile="Týmový kalendář a ranní souhrn do chatu."
          />
          <FeatureCard
            iconBg="bg-[#ECEAE3]"
            icon={<ExportIcon />}
            titleDesktop="Podklady pro mzdy jedním exportem"
            titleMobile="Export pro mzdy"
            bodyDesktop="CSV, XLSX nebo PDF připravené pro Pohodu, Pamicu a VEMA. Konec přepisování na konci měsíce."
            bodyMobile="CSV, XLSX a PDF pro Pohodu, Pamicu a VEMA."
          />
        </div>
      </Container>
    </section>
  );
}
