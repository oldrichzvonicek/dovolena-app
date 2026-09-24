"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/Sidebar";

function AppShell({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

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

  return (
    <div className="flex">
      <Sidebar />
      <div className="min-h-screen flex-1">{children}</div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Scoped here (rather than the root layout) so the marketing site and
  // legal pages can prerender without Supabase credentials configured.
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
