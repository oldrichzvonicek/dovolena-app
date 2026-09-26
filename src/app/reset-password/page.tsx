"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";
import { errorMessage } from "@/lib/utils";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);

  useEffect(() => {
    // Supabase's recovery link puts the session in the URL hash; the client picks it up on load.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Odkaz může přinést ?code= (PKCE) nebo #access_token: ?code= se vymění za relaci tady, pro jistotu i ručně.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
        if (!exErr) setReady(true);
      });
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    // Když se do pár sekund nic nepotvrdí, odkaz je vyprchaný, použitý nebo otevřený v jiném prohlížeči než žádost.
    const t = setTimeout(() => setLinkFailed(true), 6000);
    return () => {
      clearTimeout(t);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <AppLogo className="mx-auto mb-3 h-10 w-10" />
          <h1 className="font-display text-2xl">Nové heslo</h1>
        </div>

        {!ready && !done && !linkFailed && <p className="text-center text-sm text-muted">Ověřuji odkaz…</p>}
        {!ready && !done && linkFailed && (
          <div className="space-y-3 text-center text-sm">
            <p className="rounded bg-warning-light px-3 py-2 text-warning-dark">
              Odkaz se nepodařilo ověřit. Mohl vypršet, být už použitý, nebo jste ho otevřeli v jiném prohlížeči, než ve kterém jste o obnovení požádali.
            </p>
            <Link href="/login" className="font-medium text-teal-dark underline underline-offset-2">
              Požádat o nový odkaz
            </Link>
          </div>
        )}

        {ready && !done && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nové heslo</label>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
                placeholder="Minimálně 8 znaků" aria-label="Nové heslo, minimálně 8 znaků"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Potvrzení hesla</label>
              <input
                required
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="rounded bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="w-full justify-center" disabled={loading}>
              {loading ? "Ukládám…" : "Nastavit nové heslo"}
            </Button>
          </form>
        )}

        {done && <p className="text-center text-sm text-teal-dark">Heslo úspěšně změněno, přesměrovávám…</p>}
      </div>
    </div>
  );
}
