"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";
import { claimInvite } from "@/lib/admin-data";
import { joinCompanyByCode, publicCompanyNameByCode } from "@/lib/join-link";
import { saveOnboardingIntent } from "@/lib/onboarding-intent";
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
  if (m.includes("password should be at least")) return "Heslo musí mít alespoň 8 znaků.";
  if (m.includes("rate limit") || m.includes("too many")) return "Příliš mnoho pokusů. Zkuste to prosím za chvíli.";
  if (m.includes("network") || m.includes("fetch")) return "Nepodařilo se spojit se serverem. Zkontrolujte připojení.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { refreshProfile } = useAuth();

  const inviteCode = searchParams.get("pozvanka");
  const legacyLink = searchParams.get("company"); // starý odkaz s číslem firmy — už neplatí
  const [mode, setMode] = useState<Mode>(inviteCode ? "join" : "signin");
  const [inviteCompanyName, setInviteCompanyName] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // A message set together with a mode switch (e.g. "check your e-mail") must survive that switch.
  const keepMessage = useRef(false);
  // Když Supabase pošle odkaz pro obnovení hesla na přihlašovací stránku (Site URL), pošleme ho rovnou na formulář pro nové heslo.
  useEffect(() => {
    if (/type=recovery/.test(window.location.hash)) {
      window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (keepMessage.current) {
      keepMessage.current = false;
      return;
    }
    setError(null);
    setInfo(null);
  }, [mode]);

  useEffect(() => {
    try {
      const flag = sessionStorage.getItem("dodio-deactivated");
      if (flag) {
        sessionStorage.removeItem("dodio-deactivated");
        if (flag === "pending") setInfo("Váš účet čeká na schválení administrátorem firmy. Jakmile ho schválí, přihlaste se.");
        else setError("Váš účet byl deaktivován. Obraťte se na administrátora firmy.");
      }
      if (legacyLink) setError("Tento registrační odkaz už neplatí. Požádejte správce firmy o nový.");
    } catch {}
  }, []);

  useEffect(() => {
    if (!inviteCode) return;
    publicCompanyNameByCode(inviteCode)
      .then((n) => {
        setInviteCompanyName(n);
        if (!n) setError("Tento registrační odkaz už neplatí nebo byl vypnut. Požádejte správce firmy o nový.");
      })
      .catch(() => setInviteCompanyName(null));
  }, [inviteCode]);

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
      saveOnboardingIntent({ kind: "create", name, companyName });
      setLoading(false);
      setInfo("Účet vytvořen. Zkontrolujte e-mail a potvrďte registraci, pak se přihlaste — firma se založí při prvním přihlášení.");
      keepMessage.current = true;
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
    setInfo("Odkaz pro obnovení hesla jsme odeslali, pokud je tento e-mail u nás zaregistrovaný. Zkontrolujte schránku, případně i složku Spam.");
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteCode) return;
    setError(null);
    setLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setLoading(false);
      setError(czechAuthError(signUpError.message));
      return;
    }

    if (!signUpData.session) {
      saveOnboardingIntent({ kind: "join", name, joinCode: inviteCode });
      setLoading(false);
      setInfo("Účet vytvořen. Zkontrolujte e-mail a potvrďte registraci, pak se přihlaste — připojení k firmě se dokončí při prvním přihlášení.");
      keepMessage.current = true;
      setMode("signin");
      return;
    }

    try {
      // A CSV-imported / single-added invite for this exact email takes
      // priority (it carries name/department/manager/entitlements already);
      // otherwise fall back to the generic "join as plain employee" link.
      const claimedCompanyId = await claimInvite();
      if (!claimedCompanyId) {
        await joinCompanyByCode(inviteCode, name);
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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
                placeholder="Minimálně 8 znaků" aria-label="Minimálně 8 znaků"
              />
            </div>
          )}

          {error && <p className="rounded bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
          {info && (
            <div role="status" className="flex items-start gap-2 rounded border border-teal/30 bg-teal-light px-3 py-2.5 text-sm text-teal-dark">
              <Check size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{info}</span>
            </div>
          )}

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
