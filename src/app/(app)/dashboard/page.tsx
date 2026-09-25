"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { WhoIsOutToday } from "@/components/dashboard/WhoIsOutToday";
import { UpcomingLeave } from "@/components/dashboard/UpcomingLeave";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { BridgeDays } from "@/components/dashboard/BridgeDays";
import { NewRequestButton } from "@/components/dashboard/NewRequestButton";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";
import { CancellationRequests } from "@/components/manager/CancellationRequests";
import { useAuth } from "@/lib/auth-context";
import { useOnDataChanged } from "@/lib/events";
import { isNameDayFor } from "@/lib/name-days";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  useOnDataChanged(() => setRefreshKey((k) => k + 1));

  const now = new Date();
  const today = now.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const firstName = profile?.name.split(" ")[0] ?? "";
  const isMyNameDay = isNameDayFor(now, firstName);

  const subtitle = `${today.charAt(0).toUpperCase()}${today.slice(1)}${isMyNameDay ? " · Dnes máš svátek — všechno nejlepší! 🎉" : ""}`;
  const refresh = () => setRefreshKey((k) => k + 1);

  const mine = (
    <div className="space-y-6">
      <BalanceCards />
      <NewRequestButton onSaved={refresh} />
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

  // Pro všechny stejně: nahoře moje absence a rychlé žádosti, pod nimi týmový přehled (u manažera a admina i schvalování).
  return (
    <div key={refreshKey}>
      <Header title={`Vítej zpět, ${firstName}`} subtitle={subtitle} />
      <div className="p-4 pb-0 sm:p-8 sm:pb-0">
        <div className="space-y-6">
          <OnboardingChecklist />
          {mine}
        </div>
      </div>

      <section aria-labelledby="team-overview-heading" className="mt-8 border-t border-line bg-teal-light/30 px-4 py-6 sm:px-8 sm:py-8">
        <h2 id="team-overview-heading" className="mb-5 flex items-center gap-2 font-display text-h2">
          <Users size={18} className="text-teal-dark" /> {isManager ? "Týmový přehled a agenda manažera" : "Týmový přehled"}
        </h2>
        {team}
      </section>
    </div>
  );
}
