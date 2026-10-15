"use client";

import { useMemo, useState } from "react";
import { Container } from "./Container";
import { SIGNUP_URL } from "@/lib/dodio-links";
import { formatKc, getMonthlyPriceForEmployees } from "@/lib/dodio-pricing";

// Fully loaded cost of an hour of admin/manager time (wage + odvody + režie) —
// an estimate, not a real input, so it's a constant rather than a 4th field.
const HOURLY_RATE_KC = 350;

function formatHours(value: number): string {
  return value.toLocaleString("cs-CZ", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function CostCalculator() {
  const [employees, setEmployees] = useState(12);
  const [requestsPerMonth, setRequestsPerMonth] = useState(15);
  const [minutesPerRequest, setMinutesPerRequest] = useState(20);

  const { manualHours, manualCostKc, dodioCostKc, savingsKc } = useMemo(() => {
    const safeRequests = Math.max(0, requestsPerMonth);
    const safeMinutes = Math.max(0, minutesPerRequest);

    const hours = (safeRequests * safeMinutes) / 60;
    const manualCost = hours * HOURLY_RATE_KC;
    const dodioCost = getMonthlyPriceForEmployees(employees);

    return {
      manualHours: hours,
      manualCostKc: manualCost,
      dodioCostKc: dodioCost,
      savingsKc: manualCost - dodioCost,
    };
  }, [employees, requestsPerMonth, minutesPerRequest]);

  return (
    <section id="kalkulacka-nakladu" className="scroll-mt-16 font-dodio-sans lg:scroll-mt-24">
      <Container className="flex flex-col gap-8 py-14 lg:gap-10 lg:py-[112px]">
        <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3.5 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#0B7A60] lg:text-[13px]">
            Kolik vás to doopravdy stojí
          </div>
          <h2 className="m-0 font-dodio-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] text-dodio-ink lg:text-[44px] lg:leading-[50px] lg:tracking-[-1px]">
            Spočítejte si, kolik stojí ruční evidence absencí.
          </h2>
          <p className="m-0 text-[15px] leading-[23px] text-dodio-ink-muted lg:text-lg lg:leading-[28px]">
            E-mail, tabulka, kontrola zůstatku, přepis do mezd — každá žádost o absenci někomu zabere čas.
            Zadejte tři čísla a zjistíte, co vás to měsíčně stojí.
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 rounded-dodio-lg border border-dodio-border bg-dodio-surface-card p-6 lg:p-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-dodio-ink">Počet zaměstnanců</span>
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={employees}
                onChange={(event) => setEmployees(Number(event.target.value))}
                className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-dodio-ink">Žádostí o absenci / měsíc</span>
              <input
                type="number"
                min={0}
                max={1000}
                step={1}
                value={requestsPerMonth}
                onChange={(event) => setRequestsPerMonth(Number(event.target.value))}
                className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-dodio-ink">Minut na jednu žádost</span>
              <input
                type="number"
                min={0}
                max={240}
                step={1}
                value={minutesPerRequest}
                onChange={(event) => setMinutesPerRequest(Number(event.target.value))}
                className="h-11 rounded-dodio-md border border-dodio-border bg-white px-3.5 text-sm text-dodio-ink"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 rounded-dodio-lg bg-[#F6E2DE] p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-dodio-coral-dark">
                Ruční evidence vás stojí
              </div>
              <div className="font-dodio-display text-2xl font-extrabold text-dodio-ink lg:text-3xl">
                {formatHours(manualHours)} h · {formatKc(manualCostKc)}
              </div>
              <div className="text-xs text-dodio-ink-muted">měsíčně</div>
            </div>
            <div className="flex flex-col gap-1.5 rounded-dodio-lg bg-[#E3F2EC] p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-dodio-teal-dark">
                Dodio vás stojí
              </div>
              <div className="font-dodio-display text-2xl font-extrabold text-dodio-ink lg:text-3xl">
                {formatKc(dodioCostKc)}
              </div>
              <div className="text-xs text-dodio-ink-muted">měsíčně</div>
            </div>
          </div>

          {savingsKc > 0 && (
            <div className="rounded-dodio-md bg-dodio-teal-dark px-5 py-3.5 text-center text-sm font-semibold text-white">
              Ušetříte přibližně {formatKc(savingsKc)} měsíčně.
            </div>
          )}

          <a
            href={SIGNUP_URL}
            className="inline-flex w-fit items-center justify-center self-center rounded-dodio-md bg-dodio-teal-dark px-6 py-3.5 text-sm font-semibold text-white no-underline hover:bg-dodio-teal"
          >
            Vyzkoušet Dodio zdarma
          </a>

          <p className="m-0 text-xs leading-5 text-dodio-ink-muted">
            Orientační výpočet s odhadovanou cenou práce {formatKc(HOURLY_RATE_KC)}/hod (včetně odvodů a
            režie) — u vás se může lišit. Cena Dodia odpovídá tarifu podle zadaného počtu lidí (do 5 zdarma,
            dál podle ceníku výše).
          </p>
        </div>
      </Container>
    </section>
  );
}
