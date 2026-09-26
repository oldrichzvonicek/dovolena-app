"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/use-features";
import { createClient } from "@/lib/supabase/client";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { PlanTag } from "@/components/shared/FeatureGate";
import { cn } from "@/lib/utils";

type Scope = "mine" | "myteam" | "team";

const SCOPES: { key: Scope; label: string; hint: string; managersOnly?: boolean }[] = [
  { key: "mine", label: "Moje absence", hint: "Jen vaše schválené absence." },
  { key: "myteam", label: "Absence mého týmu", hint: "Vaši podřízení a oddělení, která vedete nebo zastupujete.", managersOnly: true },
  { key: "team", label: "Celá firma", hint: "Schválené absence všech lidí ve firmě. Soukromé druhy absence (např. nemoc) se ukážou jako „Nepřítomen“." },
];

/** Jiný způsob než popover v kalendáři: rozsah se vybírá předem a hned je vidět odkaz ke zkopírování i tlačítko ke stažení .ics. */
export function ICalExportPanel() {
  const { profile } = useAuth();
  const features = useFeatures();
  const [scope, setScope] = useState<Scope>("mine");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hasIcal = features.has("ical");

  useEffect(() => {
    if (!profile || !hasIcal || token) return;
    createClient()
      .rpc("get_my_calendar_token")
      .then(({ data, error: err }) => {
        if (err) setError("Odkaz se nepodařilo načíst.");
        else setToken((data as string | null) ?? null);
      });
  }, [profile, hasIcal, token]);

  if (!profile || features.loading) return null;
  if (!hasIcal) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-muted">
        Export do kalendáře je od tarifu Starter. <PlanTag feature="ical" />
      </span>
    );
  }

  const isManager = profile.role === "manager" || profile.role === "admin";
  const scopes = SCOPES.filter((s) => !s.managersOnly || isManager);
  const current = scopes.find((s) => s.key === scope) ?? scopes[0];
  const base = token && typeof window !== "undefined" ? `${window.location.origin}/api/ical/${token}` : "";
  const url = base ? (current.key === "mine" ? base : `${base}?scope=${current.key}`) : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // schránka nedostupná: odkaz jde označit a zkopírovat ručně
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
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Co se má do kalendáře posílat</legend>
        <div className="space-y-1.5">
          {scopes.map((s) => (
            <label key={s.key} className={cn("flex cursor-pointer items-start gap-2.5 rounded border px-3 py-2 text-sm", current.key === s.key ? "border-teal bg-teal-light/40" : "border-line hover:bg-paper")}>
              <input type="radio" name="ical-scope" checked={current.key === s.key} onChange={() => setScope(s.key)} className="mt-1" />
              <span>
                <span className="font-medium">{s.label}</span>
                <span className="block text-xs text-muted">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="ical-url" className="mb-1.5 block text-sm font-medium">
          Odkaz na odběr kalendáře (iCal)
        </label>
        <div className="flex items-center gap-2">
          <input id="ical-url" readOnly value={url || "Načítám…"} onFocus={(e) => e.currentTarget.select()} className="w-full rounded border border-line bg-paper px-3 py-2 text-xs text-muted" />
          <button onClick={copy} disabled={!url} className="flex shrink-0 items-center gap-1.5 rounded border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-paper disabled:opacity-50">
            {copied ? <Check size={14} className="text-teal-dark" /> : <Copy size={14} />} {copied ? "Zkopírováno" : "Kopírovat odkaz"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          V Google Kalendáři zvolte <em>Další kalendáře → Z adresy URL</em>, v Outlooku <em>Přidat kalendář → Přihlásit se z webu</em>. Nové schválené absence se pak promítnou samy.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={url || undefined}
          download="dovolena.ics"
          aria-disabled={!url}
          className={cn("inline-flex items-center gap-1.5 rounded border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-paper", !url && "pointer-events-none opacity-50")}
        >
          <Download size={14} /> Stáhnout soubor .ics
        </a>
        <button onClick={rotate} disabled={!token} className="flex items-center gap-1.5 text-xs text-muted underline hover:text-ink disabled:opacity-50">
          <RefreshCw size={12} /> Vygenerovat nový odkaz (když uniknul)
        </button>
      </div>
      <p className="text-xs text-muted">Odkaz je tajný: kdo ho má, vidí tyto absence. Nikomu ho neposílejte.</p>
      {error && <p className="text-xs text-danger-dark">{error}</p>}
    </div>
  );
}
