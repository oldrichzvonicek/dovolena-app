"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { refreshProfile } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
      setError(signUpError.message);
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

    const { error: rpcError } = await supabase.rpc("onboard_new_company", {
      p_company_name: companyName,
      p_admin_name: name,
    });
    if (rpcError) {
      setLoading(false);
      setError(rpcError.message);
      return;
    }
    await refreshProfile();
    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-ink font-display text-white">
            D
          </div>
          <h1 className="font-display text-2xl">Dovolená</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === "signin" ? "Přihlaste se ke svému účtu" : "Založte firmu a svůj účet"}
          </p>
        </div>

        <form onSubmit={mode === "signin" ? handleSignIn : handleSignUp} className="space-y-3">
          {mode === "signup" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Vaše jméno</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-line px-3 py-2 text-sm"
                  placeholder="Jan Novák"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Název firmy</label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded border border-line px-3 py-2 text-sm"
                  placeholder="NaturaMed s.r.o."
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              placeholder="jan@firma.cz"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Heslo</label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-line px-3 py-2 text-sm"
              placeholder="Minimálně 6 znaků"
            />
          </div>

          {error && <p className="rounded bg-rust-light px-3 py-2 text-sm text-rust">{error}</p>}

          <Button type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
            {loading ? "Chvilku…" : mode === "signin" ? "Přihlásit se" : "Založit firmu a účet"}
          </Button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
        >
          {mode === "signin" ? "Nemáte účet? Založte firmu" : "Už máte účet? Přihlaste se"}
        </button>
      </div>
    </div>
  );
}
