import { Container } from "./Container";
import { CircleCheckIcon, CircleCrossIcon } from "./icons";

const PAIRS = [
  {
    question: "Kdo je dnes vlastně na dovolené?",
    problem: "Zjišťujete to z tabulky, e-mailu nebo chatu — a stejně si nejste jistí.",
    solution: "Přehled absencí celého týmu na jednom místě, aktuální pro každého.",
  },
  {
    question: "Schválil už někdo moji žádost?",
    problem: "Žádosti přes e-mail nebo chat se ztrácejí. Nikdo neví, co je kde ve frontě.",
    solution: "Stav žádosti v reálném čase — schváleno, čeká, zamítnuto s důvodem. Vidíte ho hned v appce.",
  },
  {
    question: "Nevzali si dva lidi volno ve stejný týden?",
    problem: "Manažer to zjistí, až je pozdě, a tým zůstane na pár dní bez lidí.",
    solution: "Týmový kalendář a kapacitní varování, než schválení nechá tým bez lidí.",
  },
  {
    question: "Kde vezmu podklady pro mzdy?",
    problem: "Mzdová účetní shání podklady ručně — kdo měl kdy dovolenou a jestli sedí zůstatek.",
    solution: "Podklady pro mzdy jedním exportem — CSV, Excel i ODS.",
  },
];

export function ProblemSolution() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-10 lg:pb-[112px]">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Problém → Řešení
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Tohle důvěrně znáte. Dodio to řeší.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {PAIRS.map((pair) => (
            <div
              key={pair.question}
              className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:p-7"
            >
              <div className="flex gap-2.5">
                <CircleCrossIcon />
                <div className="flex flex-col gap-1">
                  <div className="font-dodio-display text-[15px] font-bold leading-[22px] text-dodio-ink lg:text-base">
                    „{pair.question}“
                  </div>
                  <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                    {pair.problem}
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5 border-t border-dodio-border pt-4">
                <CircleCheckIcon />
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-dodio-teal-dark">S Dodiem</div>
                  <p className="m-0 text-[15px] font-medium leading-[23px] text-dodio-ink lg:text-base lg:leading-[25px]">
                    {pair.solution}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
