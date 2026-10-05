"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { allowedSettingsSections } from "@/lib/access";
import { Header } from "@/components/layout/Header";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel";
import { LeaveTypesPanel } from "@/components/admin/LeaveTypesPanel";
import { CompanyProfilePanel } from "@/components/admin/CompanyProfilePanel";
import { CompanySettingsPanel } from "@/components/admin/CompanySettingsPanel";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";
import { EmailsPanel } from "@/components/admin/EmailsPanel";
import { FeatureGate } from "@/components/shared/FeatureGate";

const titles: Record<string, string> = {
  users: "Uživatelé",
  departments: "Oddělení",
  "leave-types": "Typy absencí",
  profile: "Profil firmy",
  general: "Kalendář a provoz",
  billing: "Fakturace & tarify",
  integrations: "Integrace",
  emails: "E-maily",
  audit: "Historie změn",
};

const subtitles: Record<string, string> = {
  users: "Pozvánky, role a aktivace lidí ve firmě.",
  departments: "Vedoucí, zástupci a kapacita jednotlivých oddělení.",
  "leave-types": "Dovolená, sick days a další typy absencí — co čerpají a jak se schvalují.",
  profile: "Zobrazovaný název, logo a ID firmy.",
  general: "Pracovní doba, pravidla pro žádosti, kapacita a firemní absence.",
  billing: "Tarif, fakturační údaje a archiv faktur.",
  integrations: "Napojení na Slack, Teams a další nástroje.",
  emails: "Které e-maily appka posílá a komu.",
  audit: "Kdo, kdy a co ve firmě změnil.",
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
      <Header title={`Nastavení firmy — ${titles[active]}`} subtitle={subtitles[active]} />
      {/* Bez max-width tady — některé sekce jsou tabulky (Uživatelé, Historie změn), které širokou obrazovku
          využijí; sekce s formulářem (Kalendář a provoz) si šířku omezuje sama, viz CompanySettingsPanel. */}
      <div className="p-4 sm:p-8">
        {active === "users" && <UsersPanel />}
        {active === "departments" && <DepartmentsPanel />}
        {active === "leave-types" && <LeaveTypesPanel />}
        {active === "profile" && <CompanyProfilePanel />}
        {active === "general" && <CompanySettingsPanel />}
        {active === "billing" && <BillingPanel />}
        {active === "integrations" && <IntegrationsPanel />}
        {active === "emails" && <EmailsPanel />}
        {active === "audit" && (
          <FeatureGate feature="audit_log" description="Kdo, kdy a co změnil: žádosti, lidé, nastavení. Záznamy se ukládají i v nižším tarifu, po přechodu na Pro je uvidíte.">
            <AuditLogPanel />
          </FeatureGate>
        )}
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
