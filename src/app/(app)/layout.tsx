"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { canSeeAnalytics, canSeeInsights, canSeeReports, canSeeSettings, isHr } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { HelpDrawer } from "@/components/layout/HelpDrawer";
import { ProductTour } from "@/components/layout/ProductTour";
import { ConfirmHost } from "@/components/shared/ConfirmHost";
import { Toaster } from "@/components/ui/toaster";
import { MfaGate } from "@/components/layout/MfaGate";
import { CompanyAccessGate } from "@/components/layout/CompanyAccessGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut, refreshProfile } = useAuth();
  // If a signed-in user's profile never shows up (e.g. sign-up was interrupted) offer a way out instead of a dead screen.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  // Dokončit založení firmy rovnou tady — bez toho by jediná cesta ven byla odhlásit se a registrovat znovu
  // (viz completeOnboarding: uložená volba ze signupu se smaže, jakmile ji jednou zkusí a nevyjde).
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupCompany, setSetupCompany] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  async function finishSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupBusy(true);
    setSetupError(null);
    try {
      const { error } = await createClient().rpc("onboard_new_company", { p_company_name: setupCompany, p_admin_name: setupName });
      if (error) throw error;
      await refreshProfile();
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Nepodařilo se dokončit založení firmy.");
    } finally {
      setSetupBusy(false);
    }
  }
  useEffect(() => {
    if (loading || !session || profile) {
      setWaitedTooLong(false);
      return;
    }
    const t = setTimeout(() => setWaitedTooLong(true), 8000);
    return () => clearTimeout(t);
  }, [loading, session, profile]);
  const router = useRouter();
  const pathname = usePathname();

  // Menu hiding alone is not access control — enforce the same role rules on direct URLs.
  const isAdmin = profile?.role === "admin";
  const isManager = isAdmin || profile?.role === "manager";
  const adminArea = pathname.startsWith("/admin");
  const analyticsArea = pathname.startsWith("/admin/overview");
  const insightsArea = pathname.startsWith("/admin/insights");
  const exportsArea = pathname.startsWith("/admin/exports");
  const settingsArea = pathname.startsWith("/admin/settings");
  // HR spravuje lidi (aktivace/deaktivace, zadání absence za kohokoli) — smí i do Můj tým / Zaměstnanci,
  // ale ne do Ke schválení (schvalování žádostí zůstává jen manažerům a adminovi).
  const isHrStaff = isHr(profile);
  const forbidden =
    !!profile &&
    ((adminArea && !isAdmin && !(analyticsArea && canSeeAnalytics(profile)) && !(insightsArea && canSeeInsights(profile)) && !(exportsArea && canSeeReports(profile)) && !(settingsArea && canSeeSettings(profile))) ||
      (pathname.startsWith("/approvals") && !isManager) ||
      (pathname.startsWith("/team") && !isManager && !isHrStaff));

  useEffect(() => {
    if (forbidden) router.replace("/dashboard");
  }, [forbidden, router]);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        Načítám…
      </div>
    );
  }

  // Signed in but the profile row (and company/role) hasn't loaded yet —
  // brand-new signups can hit this for a moment right after onboarding.
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-4 text-center text-sm text-muted">
        <div>Připravuji účet…</div>
        {waitedTooLong && !setupOpen && (
          <>
            <p className="max-w-sm">
              Trvá to déle než obvykle. Nejspíš jste neměli pozvánku do žádné firmy — rovnou si ji tady založte, nebo to zkuste jinak.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setSetupOpen(true)} className="rounded bg-teal-dark px-4 py-2 text-white hover:bg-teal-dark/90">
                Založit firmu
              </button>
              <button onClick={() => window.location.reload()} className="rounded border border-line bg-white px-4 py-2 text-ink hover:bg-paper">
                Obnovit stránku
              </button>
              <button onClick={() => signOut()} className="rounded border border-line bg-white px-4 py-2 text-ink hover:bg-paper">
                Odhlásit se
              </button>
            </div>
          </>
        )}
        {waitedTooLong && setupOpen && (
          <form onSubmit={finishSetup} className="w-full max-w-sm space-y-3 rounded-lg border border-line bg-white p-5 text-left">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Vaše jméno</label>
              <input
                required
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm text-ink"
                placeholder="Jan Novák"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Název firmy</label>
              <input
                required
                value={setupCompany}
                onChange={(e) => setSetupCompany(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm text-ink"
                placeholder="Název firmy s.r.o."
              />
            </div>
            {setupError && <p className="text-xs text-danger">{setupError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={setupBusy} className="rounded bg-teal-dark px-4 py-2 text-sm text-white hover:bg-teal-dark/90 disabled:opacity-60">
                {setupBusy ? "Zakládám…" : "Založit a pokračovat"}
              </button>
              <button type="button" onClick={() => setSetupOpen(false)} className="rounded border border-line px-4 py-2 text-sm text-ink hover:bg-paper">
                Zpět
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (forbidden) return null;

  return (
    <CompanyAccessGate>
    <MfaGate>
    <div className="flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-teal-dark focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Přeskočit na obsah
      </a>
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main id="main" tabIndex={-1} className="min-h-screen min-w-0 flex-1 outline-none">
        {children}
      </main>
      <CommandPalette />
      <HelpDrawer />
      <ProductTour />
      <ConfirmHost />
      <Toaster />
    </div>
    </MfaGate>
    </CompanyAccessGate>
  );
}
