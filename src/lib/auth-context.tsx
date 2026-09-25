"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { DbProfile } from "@/lib/supabase/types";

interface AuthContextValue {
  session: Session | null;
  profile: DbProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data && (data as DbProfile).active === false) {
        try {
          sessionStorage.setItem("dodio-deactivated", "1");
        } catch {}
        await supabase.auth.signOut();
        setProfile(null);
        return;
      }
      setProfile(data as DbProfile | null);
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (session?.user.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user.id) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
