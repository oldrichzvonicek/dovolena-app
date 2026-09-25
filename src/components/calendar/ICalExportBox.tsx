"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog } from "@/components/shared/ConfirmHost";

export function ICalExportBox() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"mine" | "team" | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile || token) return;
    createClient()
      .rpc("get_my_calendar_token")
      .then(({ data, error: err }) => {
        if (err) setError("Odkaz se nepodařilo načíst.");
        else setToken((data as string | null) ?? null);
      });
  }, [open, profile, token]);

  if (!profile) return null;

  const base = token ? `${window.location.origin}/api/ical/${token}` : "";
  const mineUrl = base;
  const teamUrl = base ? `${base}?scope=team` : "";

  async function copy(url: string, which: "mine" | "team") {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard access denied
    }
  }

  async function rotate() {
    if (!(await confirmDialog("Vygenerovat nový odkaz? Starý přestane fungovat a kalendář si budete muset v Google / Outlooku přihlásit znovu.", { confirmLabel: "Vygenerovat nový", danger: true }))) return;
    const { data, error: err } = await createClient().rpc("rotate_calendar_token");
    if (err) setError("Nový odkaz se nepodařilo vytvořit.");
    else {
      setError(null);
      setToken(data as string);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded border border-line px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink"
      >
        <Download size={14} /> Exportovat do kalendáře
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-white p-4 shadow-[0_8px_30px_rgba(22,35,59,0.12)]">
          <p className="text-xs text-muted">
            Vlož odkaz jako „přihlásit se ke kalendáři podle URL“ v Google Kalendáři nebo Outlooku — nové schválené absence se
            budou promítat automaticky. Odkaz je tajný, nesdílejte ho.
          </p>
          {error && <p className="mt-2 text-xs text-danger-dark">{error}</p>}

          <div className="mt-3">
            <div className="text-xs font-medium">Moje absence</div>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={mineUrl || "Načítám…"} onFocus={(e) => e.currentTarget.select()} aria-label="Odkaz na moje absence" className="w-full rounded border border-line bg-paper px-2 py-1.5 text-xs text-muted" />
              <button onClick={() => copy(mineUrl, "mine")} disabled={!mineUrl} aria-label="Kopírovat odkaz na moje absence" className="shrink-0 rounded border border-line p-1.5 hover:bg-paper disabled:opacity-50">
                {copied === "mine" ? <Check size={13} className="text-teal-dark" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs font-medium">Celý tým</div>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={teamUrl || "Načítám…"} onFocus={(e) => e.currentTarget.select()} aria-label="Odkaz na celý tým" className="w-full rounded border border-line bg-paper px-2 py-1.5 text-xs text-muted" />
              <button onClick={() => copy(teamUrl, "team")} disabled={!teamUrl} aria-label="Kopírovat odkaz na celý tým" className="shrink-0 rounded border border-line p-1.5 hover:bg-paper disabled:opacity-50">
                {copied === "team" ? <Check size={13} className="text-teal-dark" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <button onClick={rotate} disabled={!token} className="mt-3 flex items-center gap-1.5 text-xs text-muted underline hover:text-ink disabled:opacity-50">
            <RefreshCw size={12} /> Vygenerovat nový odkaz (když uniknul)
          </button>
        </div>
      )}
    </div>
  );
}
