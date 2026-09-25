"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { allowedSettingsSections } from "@/lib/access";
import { Header } from "@/components/layout/Header";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel";
import { LeaveTypesPanel } from "@/components/admin/LeaveTypesPanel";
import { CompanySettingsPanel } from "@/components/admin/CompanySettingsPanel";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";
import { EmailsPanel } from "@/components/admin/EmailsPanel";

const titles: Record<string, string> = {
  users: "Uživatelé",
  departments: "Oddělení",
  "leave-types": "Typy absencí",
  general: "Provoz & kalendář",
  billing: "Fakturace & tarify",
  integrations: "Integrace",
  emails: "E-maily",
  audit: "Historie změn",
};

function SettingsContent() {
  const section = useSearchParams().get("sekce") ?? "users";
  const { profile } = useAuth();
  const router = useRouter();
  const allowed = allowedSettingsSections(profile);
  const requested = section in titles ? section : "users";
  // HR sees only some sections; anything else goes back to the first allowed one.
  const active = allowed.length === 0 || allowed.includes(requested) ? requested : allowed[0];
  useEffect(() => {
    if (profile && allowed.length > 0 && active !== section) router.replace(`/admin/settings?sekce=${active}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, active, section]);

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
        {active === "emails" && <EmailsPanel />}
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
