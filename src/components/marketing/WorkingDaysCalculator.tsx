"use client";

import { useMemo, useState } from "react";
import { SIGNUP_URL } from "@/lib/dodio-links";

const MONTH_NAMES = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

const DAY_NAMES = ["ne", "po", "út", "st", "čt", "pá", "so"];

// Gregorian Easter (Meeus/Jones/Butcher algorithm) — deterministic date math,
// not legislation that changes year to year, so there's nothing here that
// can go stale or need re-checking against a rate table.
function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// The 13 state holidays fixed by zákon č. 245/2000 Sb. — two (Velký pátek,
// Velikonoční pondělí) move with Easter, the rest fall on the same date
// every year regardless of weekday.
function getCzechHolidays(year: number): { date: Date; name: string }[] {
  const easter = calculateEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  return [
    { date: new Date(year, 0, 1), name: "Den obnovy samostatného českého státu" },
    { date: goodFriday, name: "Velký pátek" },
    { date: easterMonday, name: "Velikonoční pondělí" },
    { date: new Date(year, 4, 1), name: "Svátek práce" },
    { date: new Date(year, 4, 8), name: "Den vítězství" },
    { date: new Date(year, 6, 5), name: "Den slovanských věrozvěstů Cyrila a Metoděje" },
    { date: new Date(year, 6, 6), name: "Den upálení mistra Jana Husa" },
    { date: new Date(year, 8, 28), name: "Den české státnosti" },
    { date: new Date(year, 9, 28), name: "Den vzniku samostatného československého státu" },
    { date: new Date(year, 10, 17), name: "Den boje za svobodu a demokracii" },
    { date: new Date(year, 11, 24), name: "Štědrý den" },
    { date: new Date(year, 11, 25), name: "1. svátek vánoční" },
    { date: new Date(year, 11, 26), name: "2. svátek vánoční" },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
}

function formatDate(date: Date): string {
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()}. ${date.getMonth() + 1}.`;
}

export function WorkingDaysCalculator() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | "all">("all");

  const result = useMemo(() => {
    const holidays = getCzechHolidays(year);
    const holidaySet = new Set(holidays.map((h) => h.date.toDateString()));

    const start = month === "all" ? new Date(year, 0, 1) : new Date(year, month, 1);
    const end = month === "all" ? new Date(year, 11, 31) : new Date(year, month + 1, 0);

    let totalDays = 0;
    let weekendDays = 0;
    let holidayWeekdays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      totalDays++;
      const day = cur.getDay();
      if (day === 0 || day === 6) {
        weekendDays++;
      } else if (holidaySet.has(cur.toDateString())) {
        holidayWeekdays++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    const holidaysInPeriod = holidays.filter((h) => h.date >= start && h.date <= end);

    return {
      totalDays,
      weekendDays,
      holidayWeekdays,
      workingDays: totalDays - weekendDays - holidayWeekdays,
      holidaysInPeriod,
    };
  }, [year, month]);

  return (
    <div className="flex flex-col gap-6 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:p-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-dodio-ink">Rok</span>
          <input
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-dodio-ink">Období</span>
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value === "all" ? "all" : Number(event.target.value))}
            className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
          >
            <option value="all">Celý rok</option>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-dodio-lg bg-[#E3F2EC] p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-dodio-teal-dark">
          Pracovních dní {month === "all" ? `v roce ${year}` : `v měsíci ${MONTH_NAMES[month]} ${year}`}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-dodio-display text-3xl font-extrabold text-dodio-ink lg:text-4xl">
            {result.workingDays}
          </span>
        </div>
        <div className="text-sm text-dodio-ink-muted">
          {result.totalDays} kalendářních dní − {result.weekendDays} víkendových − {result.holidayWeekdays}{" "}
          státních svátků v pracovním dni.
        </div>
        <a
          href={SIGNUP_URL}
          className="inline-flex w-fit items-center justify-center rounded-dodio-md bg-dodio-teal-dark px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-dodio-teal"
        >
          Ať Dodio hlídá svátky za vás
        </a>
      </div>

      {result.holidaysInPeriod.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-dodio-ink">Státní svátky v tomto období</span>
          <div className="flex flex-col">
            {result.holidaysInPeriod.map((holiday) => (
              <div
                key={holiday.name}
                className="flex items-center justify-between gap-3 border-t border-[#EFEDE6] py-2 text-sm last:border-b"
              >
                <span className="text-dodio-ink">{holiday.name}</span>
                <span className="shrink-0 text-dodio-ink-muted">{formatDate(holiday.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
