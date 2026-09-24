import { Container } from "./Container";

/**
 * Desktop-only "before/after" comparison. On mobile it's replaced by the
 * compact "Postavené pro Česko" block (BuiltForCzechiaCompact) per the
 * design's mobile artboard.
 */
export function TodayVsDodio() {
  return (
    <section className="hidden font-dodio-sans lg:block">
      <Container className="pb-[112px]">
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-5 rounded-dodio-lg bg-[#EFEDE6] p-10">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-dodio-ink-muted">
              Jak to chodí dnes
            </div>
            <div className="font-dodio-display text-[28px] font-bold leading-[34px]">
              Tabulka, e‑mail, připomínka, přepis.
            </div>
            <div className="flex flex-col gap-3 text-base leading-6 text-dodio-ink-muted">
              <div>Zaměstnanec píše šéfovi e‑mail a čeká, jestli si ho všimne.</div>
              <div>Zůstatky dovolené žijí ve sdílené tabulce, kterou nikdo nechce otevírat.</div>
              <div>Na konci měsíce se všechno ručně přepisuje do mzdového systému.</div>
            </div>
          </div>
          <div className="flex flex-col gap-5 rounded-dodio-lg bg-dodio-teal-dark p-10 text-[#F7F5F0]">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-[#9FD9C6]">S Dodiem</div>
            <div className="font-dodio-display text-[28px] font-bold leading-[34px] text-white">
              Jedno místo pro všechny absence.
            </div>
            <div className="flex flex-col gap-3 text-base leading-6 text-[#D7EEE6]">
              <div>Žádost odejde za tři kliknutí a manažerovi přijde rovnou do chatu.</div>
              <div>Každý vidí svůj zůstatek a celý tým vidí, kdo kdy chybí.</div>
              <div>Podklady pro mzdy stáhnete jedním exportem.</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
