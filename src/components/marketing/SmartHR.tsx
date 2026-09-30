import { Container } from "./Container";

const TILES = [
  { title: "Predikce kapacity", body: "Kapacita každého oddělení predikovaná 13 týdnů dopředu." },
  { title: "Trendy za rok", body: "Vývoj absencí za posledních 12 měsíců na jednom grafu." },
  { title: "Rychlost schvalování", body: "Medián doby od podání žádosti po rozhodnutí manažera." },
  {
    title: "Závazek z nevyčerpané dovolené",
    body: "Kolik peněz firmy „leží“ v nevybraných dnech dovolené.",
  },
  {
    title: "Dobití baterií",
    body: "Kdo si v posledním půlroce vzal souvislé volno — a kdo ani den.",
  },
  {
    title: "Férové plánování",
    body: "Upozornění, když by se Vánoce nebo léto řešily pořád na stejných lidech.",
  },
  {
    title: "Anonymní nemocnost po odděleních",
    body: "Jen u oddělení s 5+ lidmi, nikdy jmenovitě — bezpečné pro GDPR.",
  },
];

export function SmartHR() {
  return (
    <section className="bg-dodio-teal-dark font-dodio-sans">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#9FD9C6] lg:text-[13px]">
              Smart HR
            </div>
            <span className="rounded-dodio-sm bg-dodio-coral px-2 py-0.5 text-[11px] font-bold text-dodio-coral-dark">
              Tarif Pro
            </span>
          </div>
          <h2 className="m-0 max-w-[720px] font-dodio-display text-[30px] font-extrabold leading-[36px] text-white lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Neřídíte jen evidenci. Řídíte tým.
          </h2>
          <p className="m-0 max-w-[640px] text-[15px] leading-[23px] text-[#D7EEE6] lg:text-lg lg:leading-[28px]">
            Dodio nečeká, až se problém objeví — samo upozorní na to, co byste jinak zjistili pozdě.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {TILES.map((tile) => (
            <div
              key={tile.title}
              className="flex flex-col gap-2 rounded-dodio-lg border border-white/10 bg-white/[0.06] p-6"
            >
              <div className="font-dodio-display text-lg font-bold text-white">{tile.title}</div>
              <p className="m-0 text-sm leading-[22px] text-[#D7EEE6]">{tile.body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
