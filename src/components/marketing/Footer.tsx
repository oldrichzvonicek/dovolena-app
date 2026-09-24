import { Container } from "./Container";
import { DodioLockup } from "./DodioLogo";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

export function Footer() {
  return (
    <footer className="border-t border-dodio-border font-dodio-sans">
      <Container className="flex flex-col gap-10 py-10 lg:flex-row lg:justify-between lg:gap-12 lg:py-14">
        <div className="flex flex-col gap-3.5 lg:max-w-[320px]">
          <DodioLockup markSize={28} wordmarkClassName="text-xl lg:text-[22px]" />
          <div className="text-sm leading-[23px] text-dodio-ink-muted">
            Správa dovolených a absencí pro malé a střední české firmy.
          </div>
        </div>

        <div className="flex flex-wrap gap-10 text-sm lg:gap-20">
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-dodio-ink">Produkt</div>
            <a href="#funkce" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Funkce
            </a>
            <a href="#integrace" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Integrace
            </a>
            <a href="#cenik" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Ceník
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-dodio-ink">Kontakt</div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              {CONTACT_EMAIL}
            </a>
            <a href="/obchodni-podminky" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Obchodní podmínky
            </a>
            <a href="/ochrana-osobnich-udaju" className="text-dodio-ink-muted no-underline hover:text-dodio-teal-dark">
              Ochrana osobních údajů
            </a>
          </div>
        </div>

        <div className="text-sm text-dodio-ink-muted lg:self-end">© 2026 Dodio · dodio.cz</div>
      </Container>
    </footer>
  );
}
