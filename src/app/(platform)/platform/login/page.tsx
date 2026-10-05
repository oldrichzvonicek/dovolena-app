"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppLockup } from "@/components/shared/AppLockup";
import { platformFetch } from "@/components/platform/api";
import { inputClass, labelClass } from "@/components/platform/ui";

type Step = { kind: "password" } | { kind: "totp"; factorId: string } | { kind: "enroll"; factorId: string; qr: string; secret: string };

const REASONS: Record<string, string> = {
  session_expired: "Relace vypršela. Přihlaste se znovu.",
  mfa_required: "Dokončete prosím ověření kódem TOTP.",
  not_admin: "Tento účet nemá přístup do super-adminu.",
};

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const reason = useSearchParams().get("reason");
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(reason ? REASONS[reason] ?? null : null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Něco se nepovedlo.");
    } finally {
      setBusy(false);
    }
  }

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await platformFetch<{ step: "totp" | "enroll"; factorId?: string }>("/auth/login", { json: { email, password } });
      setPassword("");
      if (r.step === "totp" && r.factorId) {
        setStep({ kind: "totp", factorId: r.factorId });
      } else {
        const en = await platformFetch<{ factorId: string; qr: string; secret: string }>("/auth/enroll", { method: "POST", json: {} });
        setStep({ kind: "enroll", ...en });
      }
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind === "password") return;
    run(async () => {
      await platformFetch("/auth/totp", { json: { factorId: step.factorId, code } });
      window.location.href = "/";
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <AppLockup className="h-10" />
          <span className="rounded-sm bg-ink px-2 py-0.5 text-label uppercase tracking-wide text-white dark:bg-line dark:text-ink">Super-admin</span>
        </div>

        <div className="rounded border border-line bg-surface p-5 sm:p-6">
          {step.kind === "password" && (
            <form onSubmit={submitPassword} className="space-y-4" autoComplete="on">
              <h1 className="font-display text-h2">Přihlášení provozovatele</h1>
              <div>
                <label className={labelClass} htmlFor="email">E-mail</label>
                <input id="email" name="email" type="email" required autoFocus autoComplete="username" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="password">Heslo</label>
                <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "Ověřuji…" : "Pokračovat"}</Button>
            </form>
          )}

          {step.kind === "totp" && (
            <form onSubmit={submitCode} className="space-y-4">
              <h1 className="font-display text-h2">Ověřovací kód</h1>
              <p className="text-sm text-muted">Zadejte šestimístný kód z autentizační aplikace.</p>
              <input aria-label="Kód TOTP" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required autoFocus autoComplete="one-time-code" className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value)} />
              {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Ověřuji…" : "Přihlásit se"}</Button>
            </form>
          )}

          {step.kind === "enroll" && (
            <form onSubmit={submitCode} className="space-y-4">
              <h1 className="font-display text-h2">Nastavení TOTP</h1>
              <p className="text-sm text-muted">Dvoufázové ověření je pro super-admin povinné. Naskenujte QR kód v aplikaci (Google Authenticator, Microsoft Authenticator, 1Password…) a opište první kód.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.qr} alt="QR kód pro nastavení TOTP" className="mx-auto h-44 w-44 rounded border border-line bg-white p-2" />
              <p className="break-all text-center text-caption text-muted">Nebo zadejte klíč ručně: <span className="font-mono text-ink">{step.secret}</span></p>
              <input aria-label="Kód TOTP" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required autoComplete="one-time-code" className={`${inputClass} text-center font-mono text-xl tracking-[0.4em]`} value={code} onChange={(e) => setCode(e.target.value)} />
              {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || code.replace(/\s/g, "").length !== 6}>{busy ? "Ověřuji…" : "Potvrdit a přihlásit"}</Button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-caption text-muted">Interní nástroj provozovatele Dodio. Přihlášení se zaznamenává.</p>
      </div>
    </main>
  );
}
