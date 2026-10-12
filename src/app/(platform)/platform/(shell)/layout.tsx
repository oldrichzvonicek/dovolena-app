import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/toaster";
import { PlatformSidebar, type NavGroup } from "@/components/platform/PlatformSidebar";
import { resolveContext } from "@/server/platform/auth";
import { ROLE_LABELS, can } from "@/server/platform/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dodio Super-admin", robots: { index: false, follow: false } };

/** Každá stránka za přihlášením: bez platné relace, TOTP a aktivního řádku v platform_admins se jde na přihlášení. */
export default async function PlatformShell({ children }: { children: React.ReactNode }) {
  const r = await resolveContext();
  if (!r.ok) redirect(r.reason === "no_session" ? "/login" : `/login?reason=${r.reason}`);
  const { role } = r.ctx;

  // Seskupení stejné jako v menu klientské aplikace (Sidebar.tsx) — místo jednoho plochého seznamu 9 položek.
  const groups: NavGroup[] = [];
  const provoz: NavGroup["items"] = [{ key: "dashboard", href: "/", label: "Přehled" }];
  if (can(role, "company.read_billing")) provoz.push({ key: "companies", href: "/companies", label: "Firmy" });
  if (can(role, "billing.read")) provoz.push({ key: "invoices", href: "/invoices", label: "Faktury" });
  groups.push({ title: "Provoz", items: provoz });

  const compliance: NavGroup["items"] = [];
  if (can(role, "pricing.write")) compliance.push({ key: "plans", href: "/plans", label: "Ceník" });
  if (can(role, "gdpr.forward")) compliance.push({ key: "gdpr", href: "/gdpr", label: "GDPR žádosti" });
  if (can(role, "settings.write")) compliance.push({ key: "legal", href: "/legal", label: "Právní dokumenty" });
  if (compliance.length > 0) groups.push({ title: "Nastavení a soulad", items: compliance });

  const system: NavGroup["items"] = [];
  if (can(role, "settings.write")) system.push({ key: "jobs", href: "/jobs", label: "Úlohy" });
  if (can(role, "audit.read")) system.push({ key: "audit", href: "/audit", label: "Audit log" });
  if (can(role, "team.manage")) system.push({ key: "team", href: "/team", label: "Admin tým" });
  if (system.length > 0) groups.push({ title: "Systém", items: system });

  // Vercel nastavuje VERCEL_ENV automaticky (production / preview); lokálně bez něj platí NODE_ENV.
  const envLabel = process.env.VERCEL_ENV === "preview" ? "STAGING / NÁHLED NASAZENÍ" : process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production" ? "MÍSTNÍ VÝVOJ (localhost)" : null;

  return (
    <div className="min-h-screen bg-paper md:flex md:flex-col">
      {envLabel && (
        <div role="status" className="flex w-full items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          {envLabel} — zásahy tady se netýkají produkčních dat zákazníků
        </div>
      )}
      <div className="flex-1 md:flex">
        <PlatformSidebar groups={groups} user={{ name: r.ctx.name, email: r.ctx.email, roleLabel: ROLE_LABELS[role] }} canSearchCompanies={can(role, "company.read_billing")} />
        {/* Bez max-w-6xl/mx-auto: na širokých monitorech by to nechalo obsah v úzkém sloupci uprostřed, prázdné
            po obou stranách — datové tabulky (Firmy, Faktury, Audit log) mají využít celou dostupnou šířku. */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
