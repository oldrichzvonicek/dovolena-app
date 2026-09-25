"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel";
import { LeaveTypesPanel } from "@/components/admin/LeaveTypesPanel";
import { CompanySettingsPanel } from "@/components/admin/CompanySettingsPanel";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";

const titles: Record<string, string> = {
  users: "Uživatelé",
  departments: "Oddělení",
  "leave-types": "Typy absencí",
  general: "Provoz & kalendář",
  billing: "Fakturace & tarify",
  integrations: "Integrace",
  audit: "Historie změn",
};

function SettingsContent() {
  const section = useSearchParams().get("sekce") ?? "users";
  const active = section in titles ? section : "users";

  return (
    <div>
      <Header title={`Nastavení firmy — ${titles[active]}`} subtitle="Sekce nastavení najdete v menu vlevo" />
      <div className="p-4 sm:p-8">
        {active === "users" && <UsersPanel />}
        {active === "departments" && <DepartmentsPanel />}
        {active === "leave-types" && <LeaveTypesPanel />}
        {active === "general" && <CompanySettingsPanel />}
        {active === "billing" && <BillingPanel />}
        {active === "integrations" && <IntegrationsPanel />}
        {active === "audit" && <AuditLogPanel />}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
