"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { PLANS, YEARLY_NOTE, formatKc, planByKey, planPrice, recommendedFor, type Plan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Current tariff with usage, plus the full tariff comparison inline (prices calculated for the company's own user count). */
export function PlanCard({ planKey }: { planKey: string | null | undefined }) {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<number | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const plan = planByKey(planKey);
  const users = employees ?? 0;

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .then(({ count }) => setEmployees(count ?? 0));
  }, [profile]);

  const limit = plan.employeeLimit;
  const pct = limit && employees !== null ? Math.min(100, Math.round((employees / limit) * 100)) : 0;
  const overLimit = limit !== null && employees !== null && employees > limit;
  const nearLimit = limit !== null && employees !== null && employees >= limit * 0.8;
  const suggested = employees !== null ? recommendedFor(employees) : null;
  const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL;

  function choose(target: Plan) {
    const subject = encodeURIComponent(`Změna tarifu Dodio: ${plan.name} → ${target.name}`);
    const body = encodeURIComponent(
      `Dobrý den,\n\nchceme přejít z tarifu ${plan.name} na ${target.name} (${period === "yearly" ? "roční" : "měsíční"} platba).\nAktuální počet uživatelů: ${employees ?? "?"}.\n\nDěkujeme.`
    );
    window.location.href = `mailto:${salesEmail}?subject=${subject}&body=${body}`;
  }

  const priceOf = (p: Plan) => {
    const price = planPrice(p, users, period);
    return price === 0 ? "0 Kč" : `${formatKc(price)} / ${period === "monthly" ? "měs." : "rok"}`;
  };

  return (
    <div className="space-y-4">
      <div className={cn("card p-5", overLimit ? "border-danger/50" : nearLimit && "border-warning/50")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-light text-gold-dark">
              <Crown size={15} />
            </div>
            <div>
              <h2 className="font-display text-h2">
                Váš tarif: <span className="text-teal-dark">{plan.name}</span>
              </h2>
              <p className="text-xs text-muted">{planPrice(plan, users, "monthly") === 0 ? "0 Kč" : `${formatKc(planPrice(plan, users, "monthly"))} / měs.`}</p>
            </div>
          </div>
          {plan.key !== "enterprise" && (
            <Button
              variant="secondary"
              onClick={() => document.getElementById("tarify")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <ArrowDown size={15} /> Přejít na vyšší tarif
            </Button>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted">Aktivní uživatelé</span>
            <span className={cn("font-medium", overLimit && "text-danger-dark")}>
              {employees === null ? "…" : limit ? `${employees} / ${limit}` : `${employees} (v ceně ${plan.includedUsers})`}
            </span>
          </div>
          {limit !== null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper">
              <div className={cn("h-full rounded-full", overLimit ? "bg-danger" : nearLimit ? "bg-warning" : "bg-teal")} style={{ width: `${pct}%` }} />
            </div>
          )}
          {overLimit ? (
            <p className="mt-2 rounded bg-danger-light px-3 py-2 text-sm font-medium text-danger-dark">
              ⚠️ Překročen limit tarifu ({employees} / {limit} zaměstnanců). Pro zachování plné funkčnosti převedeme váš účet na odpovídající tarif
              {suggested ? ` (${suggested.name}).` : "."}
            </p>
          ) : (
            nearLimit && <p className="mt-2 text-xs text-warning-dark">Blížíte se limitu tarifu — pro další uživatele přejděte na vyšší tarif.</p>
          )}
        </div>
      </div>

      <div id="tarify" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-h2">Tarify{employees !== null ? ` — ceny pro ${employees} uživatelů` : ""}</h2>
          <div className="flex overflow-hidden rounded border border-line text-sm">
            {(["monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn("px-3 py-1.5", period === p ? "bg-teal-light font-medium text-teal-dark" : "text-muted hover:bg-paper")}
              >
                {p === "monthly" ? "Měsíčně" : `Ročně (${YEARLY_NOTE})`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => {
            const current = p.key === plan.key;
            const fits = employees === null || p.employeeLimit === null || employees <= p.employeeLimit;
            return (
              <div
                key={p.key}
                className={cn(
                  "card flex flex-col p-4",
                  current && "border-teal ring-1 ring-teal",
                  !current && p.recommended && "border-teal/60",
                  !fits && "opacity-70"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-h2">{p.name}</div>
                  {current ? (
                    <span className="rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal-dark">Váš tarif</span>
                  ) : (
                    p.recommended && <span className="rounded-full bg-gold-light px-2 py-0.5 text-[11px] font-medium text-gold-dark">Doporučeno</span>
                  )}
                </div>
                <div className="mt-1 text-lg font-medium">{priceOf(p)}</div>
                <div className="text-xs text-muted">
                  {p.employeeLimit === null ? `nad ${p.includedUsers} uživatelů` : `do ${p.employeeLimit} uživatelů`}
                  {p.key === "enterprise" && p.extraPerUserMonthly && (
                    <> · základ {formatKc(period === "monthly" ? p.monthly : p.yearly)} + {formatKc((period === "monthly" ? p.extraPerUserMonthly : p.extraPerUserYearly) ?? 0)} za každého nad {p.includedUsers}</>
                  )}
                </div>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-teal-dark" /> {f}
                    </li>
                  ))}
                </ul>
                {!fits && employees !== null && <p className="mt-2 text-xs text-warning-dark">Nestačí pro vašich {employees} uživatelů.</p>}
                <Button
                  className="mt-4 w-full justify-center"
                  variant={p.recommended && !current ? "primary" : "secondary"}
                  disabled={current || !salesEmail}
                  onClick={() => choose(p)}
                >
                  {current ? "Aktuální tarif" : "Zvolit tarif"}
                </Button>
              </div>
            );
          })}
        </div>
        {!salesEmail && <p className="mt-2 text-xs text-warning-dark">Kontaktní e-mail pro objednávku není nastaven (NEXT_PUBLIC_SALES_EMAIL).</p>}
        <p className="mt-2 text-xs text-muted">Volba tarifu otevře e-mail s předvyplněnou objednávkou — tarif se po potvrzení změní na naší straně.</p>
      </div>
    </div>
  );
}
