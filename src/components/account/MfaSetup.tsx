"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";

interface Factor {
  id: string;
  friendly_name?: string | null;
  status: string;
}

/** Zapnutí a vypnutí dvoufázového ověření (aplikace typu Google Authenticator, Microsoft Authenticator, 1Password …). */
export function MfaSetup({ onChanged }: { onChanged?: () => void }) {
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) {
      setError(errorMessage(e));
      setFactors([]);
      return;
    }
    setFactors((data?.totp ?? []) as Factor[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const verified = (factors ?? []).filter((f) => f.status === "verified");

  async function start() {
    setBusy(true);
    setError(null);
    try {
      // Nedokončené pokusy z dřívějška se uklidí, jinak by další zápis selhal.
      for (const f of (factors ?? []).filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: e } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Dodio ${new Date().toLocaleDateString("sv-SE")}` });
      if (e || !data) throw e ?? new Error("Nepodařilo se zahájit nastavení.");
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (ce || !ch) throw ce ?? new Error("Ověření se nepodařilo zahájit.");
      const { error: ve } = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: ch.id, code: code.trim() });
      if (ve) throw new Error("Kód nesouhlasí. Zkontrolujte, že máte správný čas v telefonu, a zkuste to znovu.");
      setEnrolling(null);
      showToast("Dvoufázové ověření je zapnuté.");
      await load();
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    if (!window.confirm("Opravdu vypnout dvoufázové ověření? Účet bude chráněný jen heslem.")) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (e) throw e;
      showToast("Dvoufázové ověření je vypnuté.", "info");
      await load();
      onChanged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (factors === null) return <p className="text-sm text-muted">Načítám…</p>;

  return (
    <div>
      {verified.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck size={18} className="text-teal-dark" /> <span>Dvoufázové ověření je <strong>zapnuté</strong>. Při přihlášení zadáte i kód z aplikace.</span>
          </p>
          <Button variant="secondary" onClick={() => disable(verified[0].id)} disabled={busy}>
            Vypnout
          </Button>
        </div>
      ) : enrolling ? (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Nainstalujte si na telefon aplikaci pro ověřovací kódy (Google Authenticator, Microsoft Authenticator, 1Password …).</li>
            <li>V aplikaci přidejte nový účet a naskenujte tento QR kód.</li>
            <li>Opište šestimístný kód, který aplikace ukazuje.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR kód pro aplikaci s ověřovacími kódy" className="h-44 w-44 rounded border border-line bg-white p-2" />
          <p className="text-xs text-muted">
            Nejde naskenovat? Zadejte ručně klíč: <code className="select-all rounded bg-paper px-1.5 py-0.5">{enrolling.secret}</code>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              aria-label="Šestimístný kód"
              className="w-32 rounded border border-line px-3 py-2 text-center font-mono text-lg tracking-widest"
            />
            <Button variant="primary" onClick={confirm} disabled={busy || code.length !== 6}>
              Potvrdit a zapnout
            </Button>
            <Button variant="secondary" onClick={() => setEnrolling(null)} disabled={busy}>
              Zrušit
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <ShieldOff size={18} className="text-muted" /> <span>Dvoufázové ověření je <strong>vypnuté</strong>. Účet chrání jen heslo.</span>
          </p>
          <Button variant="primary" onClick={start} disabled={busy}>
            Zapnout dvoufázové ověření
          </Button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
