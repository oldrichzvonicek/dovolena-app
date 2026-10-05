import { redirect } from "next/navigation";
import { PricingPanel } from "@/components/platform/PricingPanel";
import { Card, PageHeader, tableClass, tdClass, thClass } from "@/components/platform/ui";
import { formatDate, formatKc } from "@/components/platform/format";
import { resolveContext } from "@/server/platform/auth";
import { todayIso } from "@/server/platform/billing";
import { currentRows, loadPriceRows } from "@/server/platform/prices";
import { can } from "@/server/platform/permissions";
import { PLAN_ORDER } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const r = await resolveContext();
  if (!r.ok || !can(r.ctx.role, "pricing.write")) redirect("/login");
  const rows = await loadPriceRows();
  const today = todayIso();
  const current = currentRows(rows, today);
  const list = PLAN_ORDER.map((k) => current.get(k)).filter((x): x is NonNullable<typeof x> => !!x);
  const history = [...rows].sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1));

  return (
    <>
      <PageHeader title="Ceník" subtitle="Změna ceny vytvoří novou verzi, stará zůstává v historii. Stávajícím firmám se původní cena zamkne, dokud neuplyne oznámení." />
      <div className="space-y-6">
        <Card title="Změnit cenu">
          <PricingPanel current={list.map((p) => ({ code: p.code, name: p.name, price_monthly: p.price_monthly, price_yearly: p.price_yearly, price_extra_user_monthly: p.price_extra_user_monthly, price_extra_user_yearly: p.price_extra_user_yearly, included_users: p.included_users }))} />
        </Card>
        <Card title="Historie cen">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Tarif</th>
                  <th className={thClass}>Platí od</th>
                  <th className={`${thClass} text-right`}>Měsíčně</th>
                  <th className={`${thClass} text-right`}>Ročně</th>
                  <th className={`${thClass} text-right`}>Další uživatel (měs. / rok)</th>
                  <th className={thClass}>Stav</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>{p.name}</td>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDate(p.valid_from)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatKc(p.price_monthly)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{formatKc(p.price_yearly)}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.price_extra_user_monthly !== null ? `${formatKc(p.price_extra_user_monthly)} / ${formatKc(p.price_extra_user_yearly ?? 0)}` : "–"}</td>
                    <td className={tdClass}>{current.get(p.code)?.id === p.id ? <span className="text-teal-dark">platí dnes</span> : <span className="text-muted">starší verze</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
