"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { platformFetch } from "./api";

/** Oranžový pruh nad náhledem firmy: kdo se dívá, odpočet do konce relace a tlačítko Ukončit. */
export function ImpersonationBar({ companyName, expiresAt, companyId }: { companyName: string; expiresAt: string; companyId: string }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  const [busy, setBusy] = useState(false);

  async function end() {
    setBusy(true);
    try {
      await platformFetch("/impersonation/current", { method: "DELETE" });
    } finally {
      window.location.href = `/companies/${companyId}`;
    }
  }

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    if (left === 0) end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === 0]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div role="status" className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2.5 text-sm font-medium text-ink">
      <span className="flex items-center gap-2"><Eye size={16} /> Náhled firmy {companyName}: jen pro čtení, typ nemoci je skrytý</span>
      <span className="flex items-center gap-3">
        <span className="tabular-nums" aria-label="Zbývající čas">zbývá {mm}:{ss}</span>
        <button onClick={end} disabled={busy} className="rounded bg-ink px-3 py-1 text-white hover:bg-ink/90 disabled:opacity-50">{busy ? "Ukončuji…" : "Ukončit náhled"}</button>
      </span>
    </div>
  );
}
