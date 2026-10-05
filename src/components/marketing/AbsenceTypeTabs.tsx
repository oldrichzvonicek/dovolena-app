"use client";

import { useState } from "react";
import { Container } from "./Container";
import { CheckIcon } from "./icons";

const TABS = [
  {
    key: "dovolena",
    label: "Dovolená",
    points: [
      "Zůstatek na první pohled — čerpáno, naplánováno, zbývá.",
      "Žádost na celý den, půlden i hodiny; víkendy a svátky se odečtou samy.",
      "Schválení jedním kliknutím, v tarifu Team i automatický výpočet nároku.",
    ],
    href: "/evidence-dovolene",
    linkLabel: "Vše o evidenci dovolené",
  },
  {
    key: "absence",
    label: "Absence",
    points: [
      "Nemoc, lékař, náhradní volno, neplacené volno i vlastní typy podle vaší firmy.",
      "Nemoc zůstává soukromá — kolegové vidí jen „Nepřítomen“, typ zná jen nadřízený a HR.",
      "Historie a audit log každé změny v tarifu Team.",
    ],
    href: "/evidence-absenci",
    linkLabel: "Vše o evidenci absencí",
  },
  {
    key: "home-office",
    label: "Home office",
    points: [
      "Žádost i schválení jedním kliknutím, bez zpráv v chatu.",
      "Kalendář ukáže, kdo je doma a kdo v kanceláři.",
      "Samostatný typ absence — z dovolené se neodečítá.",
    ],
    href: "/home-office",
    linkLabel: "Vše o evidenci home office",
  },
  {
    key: "sick-days",
    label: "Sick days",
    points: [
      "Vlastní limit dní na osobu, čerpání se odečítá automaticky.",
      "Zadání z mobilu za pár sekund, i ráno z postele.",
      "Oddělený typ od nemocenské — v exportu pro mzdy jasně vidíte rozdíl.",
    ],
    href: "/sick-days",
    linkLabel: "Vše o sick days",
  },
] as const;

export function AbsenceTypeTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>("dovolena");
  const tab = TABS.find((t) => t.key === active)!;

  return (
    <section className="font-dodio-sans">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[104px]">
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Co v Dodiu evidujete
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Čtyři typy absencí, jedno místo.
          </h2>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl bg-[#F0EDE6] p-1 lg:w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={active === t.key}
              onClick={() => setActive(t.key)}
              className={`h-11 flex-1 rounded-dodio-md px-[18px] text-[15px] font-semibold lg:flex-none ${
                active === t.key ? "bg-white text-dodio-ink shadow-[0_1px_3px_rgba(44,44,42,0.15)]" : "text-dodio-ink-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:max-w-[640px] lg:p-8">
          <div className="flex flex-col gap-3">
            {tab.points.map((point) => (
              <div key={point} className="flex items-start gap-2.5">
                <span className="mt-1 shrink-0">
                  <CheckIcon />
                </span>
                <span className="text-[15px] leading-[23px] text-dodio-ink-muted lg:text-base lg:leading-[25px]">
                  {point}
                </span>
              </div>
            ))}
          </div>
          <a
            href={tab.href}
            className="w-fit text-sm font-medium text-dodio-teal-dark no-underline hover:underline"
          >
            {tab.linkLabel} →
          </a>
        </div>
      </Container>
    </section>
  );
}
