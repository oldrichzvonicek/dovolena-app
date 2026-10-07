"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { WhoIsOutToday } from "@/components/dashboard/WhoIsOutToday";
import { UpcomingLeave } from "@/components/dashboard/UpcomingLeave";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { OnboardingWizard } from "@/components/dashboard/OnboardingWizard";
import { BridgeDays } from "@/components/dashboard/BridgeDays";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";
import { CancellationRequests } from "@/components/manager/CancellationRequests";
import { useAuth } from "@/lib/auth-context";
import { useOnDataChanged } from "@/lib/events";
import { isNameDayFor } from "@/lib/name-days";
import { isHr } from "@/lib/access";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  useOnDataChanged(() => setRefreshKey((k) => k + 1));

  const now = new Date();
  const today = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  // Jméno chybí, nebo je to jen e-mail z nedokončené registrace (viz claim_invite) — "Vítejte zpět, jan@firma.cz"
  // vypadá jako chyba a na mobilu dlouhý e-mail zbytečně zabírá řádky navíc. Bez jména je lepší obecný pozdrav.
  const rawFirstName = profile?.name.split(" ")[0] ?? "";
  const firstName = rawFirstName.includes("@") ? "" : rawFirstName;
  const isMyNameDay = isNameDayFor(now, firstName);

  const subtitle = `${today.charAt(0).toUpperCase()}${today.slice(1)}${isMyNameDay ? " · Dnes máte svátek — všechno nejlepší! 🎉" : ""}`;
  const refresh = () => setRefreshKey((k) => k + 1);

  const mine = (
    <div className="space-y-6">
      <BalanceCards />
      <UpcomingLeave />
      <BridgeDays onSaved={refresh} />
    </div>
  );

  const team = (
    <div className="space-y-6">
      <PendingApprovalsWidget onChanged={refresh} />
      <CancellationRequests onChanged={refresh} />
      <WhoIsOutToday />
    </div>
  );

  // Pro všechny stejně: nahoře moje absence, pod nimi týmový přehled (u manažera a admina i schvalování).
  return (
    <div key={refreshKey}>
      <Header title={firstName ? `Vítejte zpět, ${firstName}` : "Vítejte zpět"} subtitle={subtitle} />
      {/* Ukotveno vlevo (bez mx-auto), do max-width 1600px pro širokoúhlé monitory. Od xl (>=1280px) dva
          sloupce vedle sebe — vlevo moje absence, vpravo týmový přehled; pod xl padají pod sebe. */}
      <div className="max-w-[1600px] space-y-6 p-4 sm:p-8">
        <OnboardingWizard />
        <OnboardingChecklist />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
          <div className="space-y-6">{mine}</div>
          <section aria-labelledby="team-overview-heading" className="space-y-6 rounded-lg bg-teal-light/30 p-4 sm:p-6">
            <h2 id="team-overview-heading" className="flex items-center gap-2 font-display text-h2">
              <Users size={18} className="text-teal-dark" />{" "}
              {/* "...a agenda manažera" předpokládá, že vidíte schvalování vlastního týmu — pro HR (i když má
                  roli admin) to není výstižné, ta vidí celou firmu, ne agendu manažera. */}
              {isHr(profile) ? "Přehled firmy" : isManager ? "Týmový přehled a agenda manažera" : "Týmový přehled"}
            </h2>
            {team}
          </section>
        </div>
      </div>
    </div>
  );
}
