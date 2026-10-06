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
import { NarokyZustatkyPanel } from "@/components/admin/NarokyZustatkyPanel";
import { PravidlaZadostiPanel } from "@/components/admin/PravidlaZadostiPanel";
import { PracovniKalendarPanel } from "@/components/admin/PracovniKalendarPanel";
import { BezpecnostSoukromiPanel } from "@/components/admin/BezpecnostSoukromiPanel";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { IntegrationsPanel } from "@/components/admin/IntegrationsPanel";
import { NotificationsPanel, EmailLogPanel } from "@/components/admin/EmailsPanel";
import { FeatureGate } from "@/components/shared/FeatureGate";

const titles: Record<string, string> = {
  profile: "Firma",
  users: "Lidé",
  departments: "Oddělení a schvalování",
  "leave-types": "Typy absencí",
  naroky: "Nároky a zůstatky",
  pravidla: "Pravidla žádostí",
  kalendar: "Pracovní kalendář",
  emails: "Notifikace",
  bezpecnost: "Bezpečnost a soukromí",
  billing: "Tarif a fakturace",
  integrations: "Integrace",
  audit: "Historie změn",
  "zaznamy-emaily": "Doručení e-mailů",
};

const subtitles: Record<string, string> = {
  profile: "Zobrazovaný název, logo a ID firmy.",
  users: "Pozvánky, role a aktivace lidí ve firmě.",
  departments: "Vedoucí, zástupci, kapacita a eskalace schvalování.",
  "leave-types": "Dovolená, sick days a další typy absencí — co čerpají a jak se schvalují.",
  naroky: "Výchozí roční nárok, nárok podle let, čerpání do mínusu, převod a expirace.",
  pravidla: "Minimální předstih a zpětné zadávání absencí.",
  kalendar: "Pracovní dny, hodiny, blokované termíny a celozávodní dovolená.",
  emails: "Které e-maily appka posílá a komu.",
  bezpecnost: "2FA, schvalování z e-mailu a viditelnost absencí mezi kolegy.",
  billing: "Tarif, fakturační údaje a archiv faktur.",
  integrations: "Napojení na Slack, Teams a další nástroje.",
  audit: "Kdo, kdy a co ve firmě změnil.",
  "zaznamy-emaily": "Posledních 200 odeslaných e-mailů a jejich stav.",
};

// Skupiny jen pro nadpis stránky (Sidebar má vlastní, vizuální verzi) — "Kalendář a provoz" se dřív rozbalovalo
// do šesti záložek na jedné stránce; teď má každé téma vlastní adresu a místo v menu.
const groupOf: Record<string, string> = {
  profile: "Organizace",
  users: "Organizace",
  departments: "Organizace",
  "leave-types": "Absence",
  naroky: "Absence",
  pravidla: "Absence",
  kalendar: "Absence",
  emails: "Komunikace",
  bezpecnost: "Bezpečnost a soukromí",
  billing: "Předplatné",
  integrations: "Komunikace",
  audit: "Záznamy",
  "zaznamy-emaily": "Záznamy",
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
      <Header title={`${groupOf[active] ?? "Nastavení firmy"} — ${titles[active]}`} subtitle={subtitles[active]} />
      {/* Bez max-width tady — některé sekce jsou tabulky (Lidé, Historie změn), které širokou obrazovku
          využijí; sekce s formulářem (Pracovní kalendář, Nároky a zůstatky…) si šířku omezují samy. */}
      <div className="p-4 sm:p-8">
        {active === "profile" && <CompanyProfilePanel />}
        {active === "users" && <UsersPanel />}
        {active === "departments" && <DepartmentsPanel />}
        {active === "leave-types" && <LeaveTypesPanel />}
        {active === "naroky" && <NarokyZustatkyPanel />}
        {active === "pravidla" && <PravidlaZadostiPanel />}
        {active === "kalendar" && <PracovniKalendarPanel />}
        {active === "emails" && <NotificationsPanel />}
        {active === "bezpecnost" && <BezpecnostSoukromiPanel />}
        {active === "billing" && <BillingPanel />}
        {active === "integrations" && <IntegrationsPanel />}
        {active === "audit" && (
          <FeatureGate feature="audit_log" description="Kdo, kdy a co změnil: žádosti, lidé, nastavení. Záznamy se ukládají i v nižším tarifu, po přechodu na Pro je uvidíte.">
            <AuditLogPanel />
          </FeatureGate>
        )}
        {active === "zaznamy-emaily" && <EmailLogPanel />}
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
