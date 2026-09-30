import { Container } from "./Container";

// Real product screenshots, not illustrations — experimental section, easy
// to remove (this file + the three assets in public/ukazky/ + the import
// in page.tsx) if it doesn't earn its place next to the illustrated mockups
// used elsewhere on the page.
const SHOTS = [
  {
    src: "/ukazky/tymovy-kalendar.webp",
    alt: "Týmový kalendář v Dodiu s absencemi seskupenými podle oddělení",
    caption: "Týmový kalendář — kdo je pryč a kdy, na jeden pohled.",
  },
  {
    src: "/ukazky/nastenka-manazera.gif",
    alt: "Nástěnka manažera v Dodiu se schvalováním žádostí a týdenním přehledem týmu",
    caption: "Nástěnka manažera — schválení a přehled týmu na jednom místě.",
  },
  {
    src: "/ukazky/nova-zadost.webp",
    alt: "Formulář nové žádosti o absenci v Dodiu",
    caption: "Nová žádost o absenci na pár kliknutí.",
  },
];

export function ProductPreview() {
  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 pb-14 lg:gap-10 lg:pb-[112px]">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Dodio naživo
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Takhle to vypadá doopravdy.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-6">
          {SHOTS.map((shot) => (
            <figure key={shot.src} className="m-0 flex flex-col gap-3">
              <div className="overflow-hidden rounded-dodio-lg border border-dodio-border bg-dodio-surface-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- real screenshots, incl. an animated GIF that next/image would flatten */}
                <img src={shot.src} alt={shot.alt} className="block w-full" />
              </div>
              <figcaption className="text-[13px] leading-[20px] text-dodio-ink-muted">{shot.caption}</figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
