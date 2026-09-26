"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, ChevronDown, Crown, Minus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ADDONS, FEATURE_MATRIX, PLANS, YEARLY_NOTE, formatKc, planByKey, planPrice, pricePerUser, recommendedFor, type Addon, type Plan } from "@/lib/plans";
import { useFeatures } from "@/lib/use-features";
import { changeKind, downgradeEffectiveDate, overLimitBy, quoteUpgrade, remainingDays } from "@/lib/plan-change";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { showToast } from "@/lib/toast";
import { InfoTip } from "@/components/ui/info-tip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Current tariff with usage, plus the full tariff comparison inline (prices calculated for the company's own user count). */
export interface PlanBilling {
  billing_period: "monthly" | "yearly";
  plan_paid_until: string | null;
  pending_plan: string | null;
  pending_plan_from: string | null;
}

const czDate = (iso: string) => `${+iso.slice(8, 10)}. ${+iso.slice(5, 7)}. ${iso.slice(0, 4)}`;

export function PlanCard({ planKey, billing, onChanged }: { planKey: string | null | undefined; billing?: PlanBilling; onChanged?: () => void }) {
  const { profile } = useAuth();
  const [changing, setChanging] = useState(false);
  const today = new Date().toLocaleDateString("sv-SE");
  const [employees, setEmployees] = useState<number | null>(null);
  const [period, setPeriod] = useState<"monthly" | "yearly">(billing?.billing_period ?? "monthly");
  const [showMatrix, setShowMatrix] = useState(false);
  const plan = planByKey(planKey);
  const features = useFeatures();
  const users = employees ?? 0;

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .eq("is_demo", false)
      .then(({ count, error }) => {
        if (!error) return setEmployees(count ?? 0);
        // Sloupec is_demo vzniká až po spuštění aktualizovaného schema.sql — do té doby počítáme všechny.
        createClient()
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", profile.company_id)
          .eq("active", true)
          .then(({ count: all }) => setEmployees(all ?? 0));
      });
  }, [profile]);

  const limit = plan.employeeLimit;
  const pct = limit && employees !== null ? Math.min(100, Math.round((employees / limit) * 100)) : 0;
  const overLimit = limit !== null && employees !== null && employees > limit;
  const nearLimit = limit !== null && employees !== null && employees >= limit * 0.8;
  const suggested = employees !== null ? recommendedFor(employees) : null;
  const salesEmail = process.env.NEXT_PUBLIC_SALES_EMAIL;

  const paidUntil = billing?.plan_paid_until ?? null;
  const pendingPlan = billing?.pending_plan ? planByKey(billing.pending_plan) : null;

  async function choose(target: Plan) {
    const kind = changeKind(plan.key, target.key);
    if (kind === "downgrade" && paidUntil) {
      const eff = downgradeEffectiveDate(paidUntil, today)!;
      const over = employees !== null ? overLimitBy(target.key, employees) : 0;
      const text =
        `Přejít na tarif ${target.name}? Změna se projeví až ${czDate(eff)}, po skončení zaplaceného období. Do té doby používáte ${plan.name} a peníze se nevrací.` +
        (over > 0 ? ` Pozor: máte ${employees} aktivních uživatelů, tarif ${target.name} jich umožňuje ${target.employeeLimit}. Nikoho nepřidáte, dokud jejich počet nesnížíte.` : "");
      if (!(await confirmDialog(text, { confirmLabel: "Naplánovat přechod" }))) return;
      setChanging(true);
      const { error } = await createClient().rpc("schedule_plan_downgrade", { p_plan: target.key });
      setChanging(false);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(`Přechod na ${target.name} je naplánován od ${czDate(eff)}.`);
      onChanged?.();
      return;
    }
    const quote = kind === "upgrade" && billing ? quoteUpgrade({ from: plan, to: target, users, period, paidUntil, today }) : null;
    const subject = encodeURIComponent(`Změna tarifu Dodio: ${plan.name} → ${target.name}`);
    const body = encodeURIComponent(
      `Dobrý den,\n\nchceme přejít z tarifu ${plan.name} na ${target.name} (${period === "yearly" ? "roční" : "měsíční"} platba).\nAktuální počet uživatelů: ${employees ?? "?"}.` +
        (paidUntil ? `\nAktuální tarif máme zaplacený do ${czDate(paidUntil)}.` : "") +
        (quote ? `\nOrientační doplatek podle podmínek (kredit za nevyužité období ${formatKc(quote.credit)}): ${formatKc(quote.toPay)}.` : "") +
        "\n\nDěkujeme."
    );
    window.location.href = `mailto:${salesEmail}?subject=${subject}&body=${body}`;
  }

  async function cancelChange() {
    setChanging(true);
    const { error } = await createClient().rpc("cancel_plan_change");
    setChanging(false);
    if (error) return showToast(error.message, "error");
    showToast("Naplánovaná změna tarifu je zrušená.", "info");
    onChanged?.();
  }

  function orderAddon(a: Addon) {
    const subject = encodeURIComponent(`Doplněk Dodio: ${a.name}`);
    const body = encodeURIComponent(`Dobrý den,

chceme si k tarifu ${plan.name} přikoupit doplněk ${a.name} (${period === "yearly" ? formatKc(a.yearly) + " ročně" : formatKc(a.monthly) + " měsíčně"}).

Děkujeme.`);
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
              <p className="text-xs text-muted">
                {planPrice(plan, users, "monthly") === 0 ? "0 Kč" : `${formatKc(planPrice(plan, users, "monthly"))} / měs.`}
                {paidUntil && plan.monthly > 0 && (
                  <>
                    {" "}
                    · {billing?.billing_period === "yearly" ? "roční platba" : "měsíční platba"}, {remainingDays(paidUntil, today) > 0 ? `platí do ${czDate(paidUntil)}` : `platnost skončila ${czDate(paidUntil)} — napište nám`}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {pendingPlan && billing?.pending_plan_from && (
          <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-warning/40 bg-warning-light px-4 py-3 text-sm">
            <span>
              <strong>Od {czDate(billing.pending_plan_from)} přejdete na tarif {pendingPlan.name}.</strong> Do té doby platí {plan.name}. Funkce, které {pendingPlan.name} nemá, se tehdy zamknou (data zůstanou).
            </span>
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={cancelChange} disabled={changing}>
              Zrušit změnu
            </Button>
          </div>
        )}

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
            const kind = changeKind(plan.key, p.key);
            const isPending = billing?.pending_plan === p.key;
            const quote = kind === "upgrade" && billing ? quoteUpgrade({ from: plan, to: p, users, period, paidUntil, today }) : null;
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
                <p className="mt-1 text-xs text-muted">{p.tagline}</p>
                <div className="mt-2 text-lg font-medium">{priceOf(p)}</div>
                <div className="text-xs text-muted">
                  {p.employeeLimit === null ? "bez limitu uživatelů" : `do ${p.employeeLimit} uživatelů`}
                  {p.includedUsers && p.extraPerUserMonthly && (
                    <> · základ {formatKc(period === "monthly" ? p.monthly : p.yearly)} + {formatKc((period === "monthly" ? p.extraPerUserMonthly : p.extraPerUserYearly) ?? 0)} za každého nad {p.includedUsers}</>
                  )}
                </div>
                {(pricePerUser(p) !== null || (period === "yearly" && p.monthly > 0)) && (
                  <div className="mt-0.5 text-xs text-teal-dark">
                    {pricePerUser(p) !== null && <>jen {pricePerUser(p)} Kč na osobu měsíčně</>}
                    {pricePerUser(p) !== null && period === "yearly" && p.monthly > 0 && " · "}
                    {period === "yearly" && p.monthly > 0 && <>ušetříte {formatKc(p.monthly * 12 - p.yearly)} ročně</>}
                  </div>
                )}
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-teal-dark" /> {f}
                    </li>
                  ))}
                </ul>
                {!fits && !current && employees !== null && <p className="mt-2 text-xs text-warning-dark">Tarif je pro max. {p.employeeLimit} uživatelů. Pro váš tým ({employees} členů) zvolte {recommendedFor(employees).name}.</p>}
                <Button
                  className="mt-4 w-full justify-center"
                  variant={p.recommended && !current ? "primary" : "secondary"}
                  disabled={current || changing || isPending || (kind !== "downgrade" && !fits) || (!(kind === "downgrade" && paidUntil) && !salesEmail)}
                  title={!fits ? `Tarif je určen pro maximálně ${p.employeeLimit} uživatelů` : undefined}
                  onClick={() => choose(p)}
                >
                  {current
                    ? "Aktuální tarif"
                    : isPending
                      ? `Naplánováno od ${billing?.pending_plan_from ? czDate(billing.pending_plan_from) : ""}`
                      : kind === "downgrade" && paidUntil
                        ? "Naplánovat přechod"
                        : !fits
                          ? "Pro váš tým nestačí"
                          : kind === "upgrade"
                            ? "Požádat o přechod"
                            : "Zvolit tarif"}
                </Button>
                {kind === "upgrade" && quote && (
                  <p className="mt-2 text-[11px] text-muted">
                    Orientační doplatek při přechodu dnes: <strong>{formatKc(quote.toPay)}</strong> (kredit za nevyužité období {formatKc(quote.credit)}).
                  </p>
                )}
                {kind === "downgrade" && paidUntil && !current && <p className="mt-2 text-[11px] text-muted">Platí až od {czDate(downgradeEffectiveDate(paidUntil, today)!)}, bez vrácení peněz.</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            aria-expanded={showMatrix}
            className="flex items-center gap-1.5 text-sm font-medium text-teal-dark underline underline-offset-2"
          >
            Porovnat všechny funkce <ChevronDown size={15} className={cn("transition-transform", showMatrix && "rotate-180")} />
          </button>
          {showMatrix && (
            <div className="card mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="p-3 font-medium">Funkce</th>
                    {PLANS.map((p) => (
                      <th key={p.key} className={cn("p-3 text-center font-medium", p.key === plan.key && "text-teal-dark")}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_MATRIX.map((g) => (
                    <Fragment key={g.title}>
                      <tr className="bg-paper">
                        <th colSpan={5} className="px-3 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                          {g.title}
                        </th>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.label} className="border-b border-line last:border-0">
                          <td className="p-3">
                            <div>{r.label}</div>
                            {r.benefit && <div className="text-xs text-muted">{r.benefit}</div>}
                          </td>
                          {r.values.map((v, i) => (
                            <td key={i} className="p-3 text-center">
                              {v === true ? (
                                <Check size={15} className="mx-auto text-teal-dark" aria-label="Ano" />
                              ) : v === false ? (
                                <Minus size={15} className="mx-auto text-muted" aria-label="Ne" />
                              ) : v === "addon" ? (
                                <span className="text-xs text-gold-dark">doplněk</span>
                              ) : (
                                <span className="text-xs">{v}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="font-display text-h2">Doplňky</h2>
          <p className="text-xs text-muted">Cena je za celou firmu, ne za uživatele.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ADDONS.map((a) => {
              const included = a.includedIn.includes(plan.key);
              const active = features.addons.includes(a.key);
              const buyable = !included && !active && a.availableOn.includes(plan.key);
              const price = period === "monthly" ? `${formatKc(a.monthly)} / měs.` : `${formatKc(a.yearly)} / rok`;
              return (
                <div key={a.key} className="card flex flex-col p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-display text-h2">
                      {a.name} <InfoTip text={a.info} label={`Co je ${a.name}`} />
                    </div>
                    {(included || active) && (
                      <span className="rounded-full bg-teal-light px-2 py-0.5 text-[11px] font-medium text-teal-dark">{included ? "V ceně tarifu" : "Aktivní"}</span>
                    )}
                  </div>
                  <div className="mt-1 text-lg font-medium">{included ? "0 Kč" : price}</div>
                  <p className="mt-1 flex-1 text-xs text-muted">
                    {included
                      ? "Máte v ceně svého tarifu."
                      : active
                        ? "Doplněk máte aktivní."
                        : buyable
                          ? a.key === "accountant"
                            ? "Od tarifu Starter je v ceně."
                            : "V tarifu Pro je v ceně."
                          : "V tomto tarifu se nedokupuje."}
                  </p>
                  {buyable && (
                    <Button className="mt-3 w-full justify-center" variant="secondary" disabled={!salesEmail} onClick={() => orderAddon(a)}>
                      Přikoupit
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {!salesEmail && <p className="mt-2 text-xs text-warning-dark">Kontaktní e-mail pro objednávku není nastaven (NEXT_PUBLIC_SALES_EMAIL).</p>}
        <p className="mt-2 text-xs text-muted">Volba tarifu otevře e-mail s předvyplněnou objednávkou — tarif se po potvrzení změní na naší straně.</p>
      </div>
    </div>
  );
}
