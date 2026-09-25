"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function ICalExportBox() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<"mine" | "team" | null>(null);

  if (!profile) return null;

  const base = `${window.location.origin}/api/ical/${profile.calendar_token}`;
  const mineUrl = base;
  const teamUrl = `${base}?scope=team`;

  async function copy(url: string, which: "mine" | "team") {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard access denied
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
        <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border border-line bg-white p-4 shadow-[0_8px_30px_rgba(22,35,59,0.12)]">
          <p className="text-xs text-muted">
            Vlož odkaz jako „přihlásit se ke kalendáři podle URL“ v Google Kalendáři nebo Outlooku — nové schválené absence se
            budou promítat automaticky.
          </p>

          <div className="mt-3">
            <div className="text-xs font-medium">Moje absence</div>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={mineUrl} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-line bg-paper px-2 py-1.5 text-xs text-muted" />
              <button onClick={() => copy(mineUrl, "mine")} className="shrink-0 rounded border border-line p-1.5 hover:bg-paper">
                {copied === "mine" ? <Check size={13} className="text-teal-dark" /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="text-xs font-medium">Celý tým</div>
            <div className="mt-1 flex items-center gap-1.5">
              <input readOnly value={teamUrl} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-line bg-paper px-2 py-1.5 text-xs text-muted" />
              <button onClick={() => copy(teamUrl, "team")} className="shrink-0 rounded border border-line p-1.5 hover:bg-paper">
                {copied === "team" ? <Check size={13} className="text-teal-dark" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
