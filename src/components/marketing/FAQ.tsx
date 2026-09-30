import { Container } from "./Container";
import { CONTACT_EMAIL } from "@/lib/dodio-links";

const CATEGORIES = [
  {
    title: "Používání",
    questions: [
      {
        q: "Počítá Dodio s českými svátky?",
        a: "Ano. Státní svátky jsou v kalendáři vyznačené automaticky a do čerpání dovolené se nezapočítávají.",
      },
      {
        q: "Do jakých formátů umíte exportovat podklady pro mzdy?",
        a: "CSV, Excel a ODS — najdete je od tarifu Starter. Dodio spočítá měsíční mzdový podklad i vyrovnání dovolené při odchodu zaměstnance.",
      },
      {
        q: "Jak funguje schválení, když manažer není u počítače?",
        a: "Dodio pošle e-mailové upozornění, že čeká žádost ke schválení. Manažer se přihlásí do appky — funguje i z mobilu, stačí prohlížeč — a žádost schválí nebo zamítne na pár kliknutí.",
      },
      {
        q: "Potřebujeme něco instalovat?",
        a: "Ne. Dodio běží celé v prohlížeči — funguje z počítače, tabletu i mobilu bez instalace.",
      },
      {
        q: "Jak dlouho trvá zavedení Dodia ve firmě?",
        a: "Pár minut. Zaregistrujete se, nastavíte typy absencí a nároky, pošlete týmu registrační odkaz — žádný konzultant ani zavádění na týdny.",
      },
      {
        q: "Jak složitý je přechod z Excelu do Dodio?",
        a: "Stačí naimportovat seznam zaměstnanců ze souboru a rovnou můžete schvalovat — žádné ruční zakládání účtů jeden po druhém.",
      },
    ],
  },
  {
    title: "Bezpečnost a soukromí",
    questions: [
      {
        q: "Vidí Dodio moje zdravotní údaje?",
        a: "Kolegové v týmovém kalendáři vidí jen „Nepřítomen“, ne že jde o nemoc. Konkrétní typ absence vidí jen nadřízený, admin, HR a účetní.",
      },
      {
        q: "Jak Dodio zabezpečuje naše data?",
        a: "Přístup je podle rolí (zaměstnanec, manažer, admin, HR, účetní) — každý vidí jen to, co má. Dvoufázové ověření je volitelné pro každého a povinné pro admina, HR a účetní. Data jsou hostovaná v EU.",
      },
      {
        q: "Kde jsou uložená firemní data?",
        a: "V cloudu, na serverech v EU. Appka je dostupná odkudkoli přes prohlížeč — z počítače, tabletu i mobilu, bez instalace.",
      },
      {
        q: "Může mít každý vedoucí jiná oprávnění?",
        a: "Ano. Manažer vidí a schvaluje žádosti jen za svůj tým nebo oddělení, admin má přehled za celou firmu. Role si nastavíte podle skutečné struktury firmy.",
      },
    ],
  },
  {
    title: "Ceny a plány",
    questions: [
      {
        q: "Kolik Dodio stojí?",
        a: "Do 5 lidí napořád zdarma. Placené tarify začínají na 290 Kč/měsíc a rostou podle velikosti týmu — přesné ceny najdete v ceníku výše.",
      },
      {
        q: "Co se stane, když překročím 5 zaměstnanců?",
        a: "Přejdete na placený tarif podle velikosti týmu — data, nastavení i historie zůstávají beze změny, nic se neztratí.",
      },
      {
        q: "Musím Dodio vyzkoušet na kartu?",
        a: "Ne. Tarif Free je zdarma do 5 uživatelů bez zadávání platební karty — stačí se zaregistrovat.",
      },
      {
        q: "Co když firma přeroste 30 lidí?",
        a: "Nic se neděje — tarif Pro nemá horní limit uživatelů. Nad 30 lidí zaplatíte 39 Kč měsíčně za každého dalšího, Dodio zůstává stejné.",
      },
      {
        q: "Co je Smart HR?",
        a: "Nástroje pro řízení týmu navíc k evidenci — predikce kapacity oddělení, upozornění na nerovnoměrné čerpání dovolené v týmu a přehled, kdo si dovolenou skutečně vybírá. Součást tarifu Pro, nebo jako doplněk k nižším tarifům.",
      },
      {
        q: "Jsme vázáni dlouhodobou smlouvou?",
        a: "Ne. Vybíráte si měsíční nebo roční platbu (roční vychází levněji) a tarif si kdykoli upravíte podle velikosti týmu.",
      },
    ],
  },
];

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="grid grid-cols-1 gap-8 py-14 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-20 lg:py-[112px]">
        <div className="flex flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Časté otázky
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Vše, co potřebujete vědět před vyzkoušením.
          </h2>
          <p className="m-0 text-[15px] leading-[24px] text-dodio-ink-muted">
            Nenašli jste odpověď na svůj dotaz? Napište nám na{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-dodio-teal-dark no-underline hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col gap-8 lg:gap-10">
          {CATEGORIES.map((category) => (
            <div key={category.title} className="flex flex-col">
              <div className="pb-2 text-xs font-semibold uppercase tracking-wide text-dodio-teal-dark">
                {category.title}
              </div>
              {category.questions.map((item, i) => (
                <details
                  key={item.q}
                  className={`border-t border-dodio-border py-5 lg:py-6 ${
                    i === category.questions.length - 1 ? "border-b" : ""
                  }`}
                >
                  <summary className="cursor-pointer font-dodio-display text-lg font-bold lg:text-xl">
                    {item.q}
                  </summary>
                  <p className="m-0 mt-3 text-[15px] leading-[24px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
