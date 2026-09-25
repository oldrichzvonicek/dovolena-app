"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/shared/AppLogo";
import { errorMessage } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase's recovery link puts the session in the URL hash; the client picks it up on load.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
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

        {!ready && !done && <p className="text-center text-sm text-muted">Ověřuji odkaz…</p>}

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
                placeholder="Minimálně 6 znaků" aria-label="Minimálně 6 znaků"
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
