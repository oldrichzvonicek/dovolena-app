"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Balance, HomeOfficeYear, loadBalances, loadHomeOfficeYear, remainingOf } from "@/lib/balances";
import { formatNumber } from "@/lib/utils";

/** Slim three-card version of the dashboard balances, for the top of Moje žádosti. */
export function CompactBalances() {
  const { profile } = useAuth();
  const [vac, setVac] = useState<Balance | null>(null);
  const [sick, setSick] = useState<Balance | null>(null);
  const [ho, setHo] = useState<HomeOfficeYear | null>(null);

  function load() {
    if (!profile) return;
    loadBalances(profile.company_id, { profileId: profile.id }).then((b) => {
      setVac(b.get(profile.id, "vacation"));
      setSick(b.get(profile.id, "sick"));
    });
    loadHomeOfficeYear(profile.company_id, profile.id).then(setHo);
  }

  useEffect(load, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vac || !sick || !ho) return null;

  const cards = [
    { label: "Dovolená", main: `${formatNumber(remainingOf(vac))} z ${formatNumber(vac.total)} dní zbývá`, sub: `${formatNumber(vac.used)} vyčerpáno${vac.upcoming > 0 ? ` · ${formatNumber(vac.upcoming)} schváleno` : ""}` },
    { label: "Sick Days", main: `${formatNumber(remainingOf(sick))} z ${formatNumber(sick.total)} dní zbývá`, sub: `${formatNumber(sick.used)} vyčerpáno` },
    { label: "Home Office", main: ho.limit !== null ? `${formatNumber(ho.used)} z ${formatNumber(ho.limit)} dní letos` : `${formatNumber(ho.used)} dní letos`, sub: `tento měsíc ${formatNumber(ho.thisMonth)}` },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="card px-4 py-2.5">
          <div className="text-xs text-muted">{c.label}</div>
          <div className="text-sm font-medium">{c.main}</div>
          <div className="text-[11px] text-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
