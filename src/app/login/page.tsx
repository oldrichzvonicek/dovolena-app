"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";
import { claimInvite, joinExistingCompany, publicCompanyName } from "@/lib/admin-data";
import { errorMessage } from "@/lib/utils";

type Mode = "signin" | "signup" | "join" | "forgot";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function czechAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Nesprávný e-mail nebo heslo.";
  if (m.includes("email not confirmed")) return "E-mail zatím není potvrzený — klikněte na odkaz v potvrzovacím e-mailu.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Tento e-mail už je zaregistrovaný — přihlaste se.";
  if (m.includes("password should be at least")) return "Heslo musí mít alespoň 6 znaků.";
  if (m.includes("rate limit") || m.includes("too many")) return "Příliš mnoho pokusů. Zkuste to prosím za chvíli.";
  if (m.includes("network") || m.includes("fetch")) return "Nepodařilo se spojit se serverem. Zkontrolujte připojení.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { refreshProfile } = useAuth();

  const inviteCompanyId = searchParams.get("company");
  const [mode, setMode] = useState<Mode>(inviteCompanyId ? "join" : "signin");
  const [inviteCompanyName, setInviteCompanyName] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    setInfo(null);
  }, [mode]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("dodio-deactivated")) {
        sessionStorage.removeItem("dodio-deactivated");
        setError("Váš účet byl deaktivován. Obraťte se na administrátora firmy.");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!inviteCompanyId) return;
    publicCompanyName(inviteCompanyId)
      .then(setInviteCompanyName)
      .catch(() => setInviteCompanyName(null));
  }, [inviteCompanyId]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(czechAuthError(error.message));
      return;
    }
    router.push("/dashboard");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(czechAuthError(signUpError.message));
      return;
    }

    // If email confirmation is required, there's no session yet — the
    // onboarding RPC needs auth.uid(), so it has to wait until sign-in.
    if (!signUpData.session) {
      setLoading(false);
      setError(
        "Účet vytvořen. Zkontrolujte e-mail a potvrďte registraci, pak se přihlaste — firma se založí při prvním přihlášení."
      );
      setMode("signin");
      return;
    }

    // This email might already be sitting in a company's pending invite list
    // (single add or CSV import) — if so, join that company pre-filled
    // instead of creating a brand new one.
    try {
      const claimedCompanyId = await claimInvite();
      if (claimedCompanyId) {
        await refreshProfile();
        setLoading(false);
        router.push("/dashboard");
        return;
      }
    } catch {
      // no pending invite for this email — fall through to creating a new company
    }

    const { error: rpcError } = await supabase.rpc("onboard_new_company", {
      p_company_name: companyName,
      p_admin_name: name,
    });
    if (rpcError) {
      setLoading(false);
      setError(czechAuthError(rpcError.message));
      return;
    }
    await refreshProfile();
    setLoading(false);
    router.push("/dashboard");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    // Always show the same message, whether or not the email exists — don't leak which emails have accounts.
    // Not an error, so it gets the neutral/warning styling below, not the danger-red one.
    setInfo("Pokud pod tímto e-mailem existuje účet, poslali jsme na něj odkaz pro obnovení hesla.");
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCompanyId) return;
    setError(null);
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(czechAuthError(signUpError.message));
      return;
    }

    if (!signUpData.session) {
      setLoading(false);
      setError("Účet vytvořen. Zkontrolujte e-mail a potvrďte registraci, pak se přihlaste stejným odkazem.");
      return;
    }

    try {
      // A CSV-imported / single-added invite for this exact email takes
      // priority (it carries name/department/manager/entitlements already);
      // otherwise fall back to the generic "join as plain employee" link.
      const claimedCompanyId = await claimInvite();
      if (!claimedCompanyId) {
        await joinExistingCompany(inviteCompanyId, name);
      }
      await refreshProfile();
      router.push("/dashboard");
    } catch (err) {
      setError(`Pozvánku se nepodařilo použít: ${errorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <AppLogo className="mx-auto mb-3 h-10 w-10" />
          <h1 className="font-display text-2xl">Dodio</h1>
          <p className="mt-0.5 text-sm font-medium text-teal-dark">Správa firemních absencí na pár kliknutí</p>
          <p className="mt-3 text-sm text-muted">
            {mode === "signin" && "Přihlaste se ke svému účtu"}
            {mode === "signup" && "Založte firmu a svůj účet"}
            {mode === "join" && (inviteCompanyName ? `Připojte se k firmě ${inviteCompanyName}` : "Připojte se k firmě")}
            {mode === "forgot" && "Zadejte e-mail a pošleme vám odkaz pro obnovení hesla"}
          </p>
        </div>

        <form
          onSubmit={
            mode === "signin"
              ? handleSignIn
              : mode === "signup"
                ? handleSignUp
                : mode === "forgot"
                  ? handleForgotPassword
                  : handleJoin
          }
          className="space-y-3"
        >
          {(mode === "signup" || mode === "join") && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Vaše jméno</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
                placeholder="Jan Novák" aria-label="Jan Novák"
              />
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Název firmy</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
                placeholder="NaturaMed s.r.o." aria-label="NaturaMed s.r.o."
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              placeholder="jan@firma.cz" aria-label="jan@firma.cz"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium">Heslo</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    className="text-xs text-muted hover:text-teal-dark"
                  >
                    Zapomenuté heslo?
                  </button>
                )}
              </div>
              <input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
                placeholder="Minimálně 6 znaků" aria-label="Minimálně 6 znaků"
              />
            </div>
          )}

          {error && <p className="rounded bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
          {info && <p className="rounded bg-warning-light px-3 py-2 text-sm text-warning-dark">{info}</p>}

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
            {loading
              ? "Chvilku…"
              : mode === "signin"
                ? "Přihlásit se"
                : mode === "signup"
                  ? "Založit firmu a účet"
                  : mode === "forgot"
                    ? "Poslat odkaz pro obnovení"
                    : "Připojit se a vytvořit účet"}
          </Button>
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
          >
            Zpět na přihlášení
          </button>
        ) : mode === "join" ? (
          <button
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
          >
            Máte už účet? Přihlaste se
          </button>
        ) : (
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
          >
            {mode === "signin" ? "Nemáte účet? Založte firmu" : "Už máte účet? Přihlaste se"}
          </button>
        )}
      </div>
    </div>
  );
}
