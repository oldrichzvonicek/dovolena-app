"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MfaSetup } from "@/components/account/MfaSetup";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";
import { errorMessage } from "@/lib/utils";

type State = "checking" | "ok" | "challenge" | "enroll";

/**
 * Brána dvoufázového ověření: kdo má 2FA zapnuté, musí po přihlášení zadat kód; když firma vyžaduje 2FA pro admina, HR
 * a účetní a dotyčný ho nemá, musí ho nejdřív nastavit. (Kontrola je v aplikaci — přístup k datům řídí přihlášení a RLS.)
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const [state, setState] = useState<State>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [{ data: aal }, { data: factors }, { data: company }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
      supabase.from("companies").select("require_mfa_staff").eq("id", profile.company_id).single(),
    ]);
    const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
    if (verified.length > 0 && aal?.currentLevel !== "aal2") {
      setFactorId(verified[0].id);
      setState("challenge");
      return;
    }
    const isStaff = profile.role === "admin" || !!profile.staff_role;
    if (isStaff && company?.require_mfa_staff === true && verified.length === 0) {
      setState("enroll");
      return;
    }
    setState("ok");
  }, [profile]);

  useEffect(() => {
    check();
  }, [check]);

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId });
      if (ce || !ch) throw ce ?? new Error("Ověření se nepodařilo zahájit.");
      const { error: ve } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() });
      if (ve) throw new Error("Kód nesouhlasí. Zkuste to znovu (kód se mění každých 30 vteřin).");
      setCode("");
      setState("ok");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === "ok") return <>{children}</>;
  if (state === "checking") return <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-muted">Načítám…</div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-5 text-center">
          <AppLogo className="mx-auto mb-3 h-10 w-10" />
          <h1 className="flex items-center justify-center gap-2 font-display text-2xl">
            <ShieldCheck size={22} className="text-teal-dark" /> {state === "challenge" ? "Dvoufázové ověření" : "Zapněte dvoufázové ověření"}
          </h1>
        </div>
        {state === "challenge" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-muted">Zadejte šestimístný kód z aplikace pro ověřovací kódy.</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label="Šestimístný kód"
              placeholder="123456"
              className="w-full rounded border border-line px-3 py-3 text-center font-mono text-2xl tracking-widest"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={busy || code.length !== 6}>
              {busy ? "Ověřuji…" : "Pokračovat"}
            </Button>
            <button type="button" onClick={signOut} className="w-full text-center text-sm text-muted underline">
              Odhlásit se
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">Vaše firma vyžaduje dvoufázové ověření pro správce, HR a účetní, protože pracují s citlivými údaji kolegů. Nastavení zabere minutu.</p>
            <MfaSetup onChanged={check} />
            <button type="button" onClick={signOut} className="w-full text-center text-sm text-muted underline">
              Odhlásit se
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
