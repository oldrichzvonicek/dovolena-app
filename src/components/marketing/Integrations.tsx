import { Container } from "./Container";
import { CircleCheckIcon } from "./icons";

const CZECH_POINTS = [
  { strong: "České státní svátky", rest: " se do čerpání dovolené nezapočítají." },
  {
    strong: "Typy absencí podle české praxe",
    rest: " – dovolená, nemoc, lékař, home office, neplacené a náhradní volno.",
  },
  {
    strong: "Exporty do CSV, Excelu a ODS",
    rest: " – měsíční mzdový podklad i vyrovnání dovolené při odchodu zaměstnance.",
  },
  { strong: "Cena v korunách", rest: " – paušál podle velikosti týmu, bez přepočítávání lidí." },
  { strong: "Appka celá v češtině", rest: " – žádné anglické HR pojmy, kterým tým nerozumí." },
  { strong: "GDPR ready", rest: "" },
];

const INTEGRATION_GROUPS = [
  { title: "Kalendáře", items: ["Google Kalendář", "Outlook", "iCal"] },
  { title: "Mzdy a účetnictví", items: ["CSV", "Excel", "ODS"] },
  { title: "Chystáme", items: ["Slack", "Microsoft Teams", "Discord", "Webhooky"] },
];

export function Integrations() {
  return (
    <section id="integrace" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="grid grid-cols-1 items-start gap-12 py-14 lg:grid-cols-2 lg:gap-20 lg:py-[112px]">
        <div className="flex flex-col gap-5 lg:gap-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Postavené pro Česko
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Software, který rozumí českému pracovnímu prostředí.
          </h2>
          <p className="m-0 max-w-[520px] text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
            Dodio počítá s českými pravidly, svátky i způsobem evidence absencí. Nemusíte nic
            přizpůsobovat softwaru vytvořenému pro jiný trh — je to naopak.
          </p>
          <div className="flex flex-col gap-4 pt-2">
            {CZECH_POINTS.map((point) => (
              <div key={point.strong} className="flex gap-3.5">
                <CircleCheckIcon />
                <div className="text-[15px] leading-[24px] lg:text-[17px] lg:leading-[26px]">
                  <strong className="font-semibold">{point.strong}</strong>
                  <span className="text-dodio-ink-muted">{point.rest}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="m-0 text-sm text-dodio-ink-muted">
            Kolik pracovních dní má letošní rok?{" "}
            <a href="/kalkulacka-pracovnich-dnu" className="text-dodio-teal-dark underline underline-offset-2">
              Spočítejte si to i se svátky
            </a>
            .
          </p>
        </div>

        <div className="flex flex-col gap-6 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-7 lg:gap-7 lg:p-10">
          <div className="flex flex-col gap-2">
            <h3 className="m-0 font-dodio-display text-xl font-bold lg:text-2xl">
              Napojí se na to, co už používáte
            </h3>
            <p className="m-0 text-[15px] leading-6 text-dodio-ink-muted lg:text-base">
              Nemusíte měnit návyky týmu. Dodio přijde za vámi.
            </p>
          </div>
          {INTEGRATION_GROUPS.map((group) => {
            const upcoming = group.title === "Chystáme";
            return (
              <div key={group.title} className="flex flex-col gap-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-dodio-ink-muted">
                  {group.title}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className={
                        upcoming
                          ? "rounded-dodio-md border border-dashed border-dodio-border px-4 py-2.5 text-[15px] font-medium text-dodio-ink-muted"
                          : "rounded-dodio-md border border-dodio-border bg-dodio-surface px-4 py-2.5 text-[15px] font-medium"
                      }
                    >
                      {item}
                    </span>
                  ))}
                </div>
                {upcoming && (
                  <p className="m-0 text-[13px] leading-5 text-dodio-ink-muted">
                    Do té doby stačí e-mailové upozornění a schválení přímo v appce — pokryje naprostou
                    většinu týmů.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
