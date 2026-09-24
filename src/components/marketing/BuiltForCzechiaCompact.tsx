import { Container } from "./Container";

/** Mobile-only compact substitute for TodayVsDodio, per the mobile artboard. */
export function BuiltForCzechiaCompact() {
  return (
    <section className="font-dodio-sans lg:hidden">
      <Container className="pb-12">
        <div className="flex flex-col gap-3.5 rounded-dodio-lg bg-dodio-teal-dark p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#9FD9C6]">
            Postavené pro Česko
          </div>
          <div className="font-dodio-display text-2xl font-bold leading-[30px] text-white">
            České svátky, české typy absencí, české mzdové systémy.
          </div>
          <div className="text-[15px] leading-[23px] text-[#D7EEE6]">
            Svátky se do dovolené nezapočítají samy. Dovolená, nemoc, lékař, home office, neplacené i
            náhradní volno.
          </div>
        </div>
      </Container>
    </section>
  );
}
