"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { WhoIsOutToday } from "@/components/dashboard/WhoIsOutToday";
import { UpcomingLeave } from "@/components/dashboard/UpcomingLeave";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const today = new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div key={refreshKey}>
      <Header title={`Vítej zpět, ${profile?.name.split(" ")[0] ?? ""}`} subtitle={today} />
      <div className="space-y-6 p-8">
        <BalanceCards />

        <div>
          <RequestLeaveModal onCreated={() => setRefreshKey((k) => k + 1)} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <WhoIsOutToday />
          <UpcomingLeave />
        </div>
      </div>
    </div>
  );
}
