"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { HelpDrawer } from "@/components/layout/HelpDrawer";
import { ProductTour } from "@/components/layout/ProductTour";
import { ConfirmHost } from "@/components/shared/ConfirmHost";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Menu hiding alone is not access control — enforce the same role rules on direct URLs.
  const isAdmin = profile?.role === "admin";
  const isManager = isAdmin || profile?.role === "manager";
  const forbidden =
    !!profile && ((pathname.startsWith("/admin") && !isAdmin) || ((pathname.startsWith("/approvals") || pathname.startsWith("/team")) && !isManager));

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
      <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">
        Připravuji účet…
      </div>
    );
  }

  if (forbidden) return null;

  return (
    <div className="flex">
      <Sidebar />
      <div className="min-h-screen flex-1">{children}</div>
      <CommandPalette />
      <HelpDrawer />
      <ProductTour />
      <ConfirmHost />
    </div>
  );
}
