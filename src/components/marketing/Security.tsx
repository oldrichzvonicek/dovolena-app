import { Container } from "./Container";
import { CircleCheckIcon } from "./icons";

const POINTS = [
  {
    strong: "Přístup podle rolí",
    rest: " – zaměstnanec, manažer, admin, a doplňkové role HR a Účetní. Každý vidí jen to, co má.",
  },
  {
    strong: "Soukromí zdravotních údajů je v základu appky",
    rest: " – kolegové vidí jen „Nepřítomen“, typ absence jen nadřízený, admin, HR a účetní.",
  },
  {
    strong: "Dvoufázové ověření (2FA)",
    rest: " – volitelné pro každého, povinné pro admina, HR a účetní.",
  },
  { strong: "Historie změn", rest: " – kdo, kdy a co změnil, dohledatelné a filtrovatelné." },
  { strong: "Data hostovaná v EU", rest: " a appka celá v češtině." },
];

export function Security() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-10 lg:pb-[112px]">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Bezpečnost a soukromí
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Soukromí je výchozí stav, ne nastavení.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-5">
          {POINTS.map((point) => (
            <div key={point.strong} className="flex gap-3.5">
              <CircleCheckIcon />
              <div className="text-[15px] leading-[24px] lg:text-[17px] lg:leading-[26px]">
                <strong className="font-semibold">{point.strong}</strong>
                <span className="text-dodio-ink-muted">{point.rest}</span>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
