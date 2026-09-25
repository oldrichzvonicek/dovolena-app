"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { setJoinLink } from "@/lib/join-link";
import { useJoinLink } from "@/lib/use-join-link";
import { errorMessage } from "@/lib/utils";

/** Admin: the company's registration link — on/off, approval of newcomers, and a new code when the link leaks. */
export function JoinLinkCard() {
  const { info, url, loading, failed, reload } = useJoinLink(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(enabled: boolean, requireApproval: boolean, regenerate = false) {
    setBusy(true);
    setError(null);
    try {
      await setJoinLink(enabled, requireApproval, regenerate);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (!info) return;
    if (!(await confirmDialog("Vygenerovat nový registrační odkaz? Starý přestane okamžitě fungovat — už rozeslané odkazy bude potřeba poslat znovu.", { confirmLabel: "Vygenerovat nový", danger: true }))) return;
    await apply(info.enabled, info.require_approval, true);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  if (failed) return null; // SQL not deployed yet
  if (loading || !info) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <KeyRound size={15} />
        </div>
        <h2 className="font-display text-h2">Registrační odkaz</h2>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">{info.enabled ? "Zapnutý" : "Vypnutý"}</span>
          <Switch checked={info.enabled} disabled={busy} onCheckedChange={(v) => apply(v, info.require_approval)} label="Zapnout registrační odkaz" />
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        Kdo odkaz dostane, se může zaregistrovat do vaší firmy. Odkaz obsahuje tajný kód — když unikne, vypněte ho nebo vygenerujte nový.
      </p>

      {info.enabled && url && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Registrační odkaz" className="min-w-0 flex-1 rounded border border-line bg-paper px-3 py-2 text-sm text-muted" />
          <Button variant="secondary" onClick={copy}>
            {copied ? <Check size={14} className="text-teal-dark" /> : <Copy size={14} />} {copied ? "Zkopírováno" : "Kopírovat"}
          </Button>
          <Button variant="secondary" onClick={regenerate} disabled={busy}>
            <RefreshCw size={14} /> Nový odkaz
          </Button>
        </div>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" checked={info.require_approval} disabled={busy} onChange={(e) => apply(info.enabled, e.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>
          Nové lidi z odkazu musí schválit admin
          <span className="block text-xs text-muted">Doporučeno. Do schválení se dotyčný nepřihlásí a nic ve firmě neuvidí.</span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-danger-dark">{error}</p>}
    </div>
  );
}
