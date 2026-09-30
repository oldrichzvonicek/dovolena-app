import { Container } from "./Container";
import { DodioLockup } from "./DodioLogo";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

export function Footer() {
  return (
    <footer className="border-t border-dodio-border font-dodio-sans">
      <Container className="flex flex-col gap-10 py-10 lg:flex-row lg:justify-between lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-3.5 lg:max-w-[280px]">
          <DodioLockup markSize={28} wordmarkClassName="text-xl lg:text-[22px]" />
          <div className="text-sm leading-[23px] text-dodio-ink-muted">
            Správa dovolených a absencí pro malé a střední české firmy.
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-sm leading-[21px] text-dodio-ink-muted">
            <div className="font-semibold text-dodio-ink">Provozovatel služby:</div>
            <div>Vinyl Garden s.r.o.</div>
            <div>Zavadilka 2036, 370 05 České Budějovice</div>
            <div>IČO: 21984697</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-10 text-sm lg:gap-16">
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-dodio-ink">Produkt</div>
            <a href="/#funkce" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Pro koho
            </a>
            <a href="/#cenik" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Ceník
            </a>
            <a href="/#integrace" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Integrace
            </a>
            <a href="/navody" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Návody
            </a>
            <a href="/sablona-dochazky-2027" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Šablona docházky zdarma
            </a>
            <a href="/kalkulacka-dovolene" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Kalkulačka dovolené
            </a>
            <a href="/kalkulacka-pracovnich-dnu" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Kalkulačka pracovních dnů
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-dodio-ink">Kontakt a právo</div>
            <a href="/kontakt" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Kontakt
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              {CONTACT_EMAIL}
            </a>
            <a href="/obchodni-podminky" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Obchodní podmínky
            </a>
            <a href="/ochrana-osobnich-udaju" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Ochrana osobních údajů
            </a>
            <a href="/bezpecnost-dat" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Bezpečnost dat
            </a>
            {/* Decorative until there's a real status page to link and monitor — no live data behind the dot. */}
            <span className="flex items-center gap-1.5 text-dodio-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-dodio-teal" aria-hidden="true" />
              Dodio status
            </span>
          </div>
        </div>
      </Container>

      <div className="border-t border-dodio-border">
        <Container className="py-5 text-xs leading-[19px] text-dodio-ink-muted lg:text-sm lg:leading-5">
          © 2026 Dodio · Všechna práva vyhrazena. Společnost je zapsaná v obchodním rejstříku vedeném u
          Krajského soudu v Českých Budějovicích pod spisovou značkou C 34524.
        </Container>
      </div>
    </footer>
  );
}
