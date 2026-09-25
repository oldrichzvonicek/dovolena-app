"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { canSeeAnalytics, canSeeReports, canSeeSettings } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { HelpDrawer } from "@/components/layout/HelpDrawer";
import { ProductTour } from "@/components/layout/ProductTour";
import { ConfirmHost } from "@/components/shared/ConfirmHost";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  // If a signed-in user's profile never shows up (e.g. sign-up was interrupted) offer a way out instead of a dead screen.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
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
  const exportsArea = pathname.startsWith("/admin/exports");
  const settingsArea = pathname.startsWith("/admin/settings");
  const forbidden =
    !!profile &&
    ((adminArea && !isAdmin && !(analyticsArea && canSeeAnalytics(profile)) && !(exportsArea && canSeeReports(profile)) && !(settingsArea && canSeeSettings(profile))) ||
      ((pathname.startsWith("/approvals") || pathname.startsWith("/team")) && !isManager));

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
        {waitedTooLong && (
          <>
            <p className="max-w-sm">
              Trvá to déle než obvykle. Váš účet se nepodařilo dokončit — zkuste stránku obnovit, nebo se odhlaste a zaregistrujte znovu. Kdyby potíže trvaly, kontaktujte správce firmy.
            </p>
            <div className="flex gap-2">
              <button onClick={() => window.location.reload()} className="rounded border border-line bg-white px-4 py-2 text-ink hover:bg-paper">
                Obnovit stránku
              </button>
              <button onClick={() => signOut()} className="rounded bg-teal-dark px-4 py-2 text-white hover:bg-teal-dark/90">
                Odhlásit se
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (forbidden) return null;

  return (
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
    </div>
  );
}
