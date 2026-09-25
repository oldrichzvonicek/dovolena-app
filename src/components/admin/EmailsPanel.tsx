"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock, RefreshCw, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";
import { EMAIL_CATEGORIES, EmailCategoryKey, EmailStatus, PLANNED_TEMPLATES, STATUS_LABEL, categoryLabel, isCategoryEnabled } from "@/lib/email-settings";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingLines } from "@/components/ui/skeleton";
import { cn, errorMessage } from "@/lib/utils";

interface LogRow {
  id: string;
  created_at: string;
  sent_at: string | null;
  to_email: string;
  category: string | null;
  subject: string;
  attempts: number;
  error: string | null;
  status: EmailStatus;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Správa e-mailů (admin a HR): co Dodio posílá a komu + přepínače kategorií; přehled odeslaných e-mailů má jen admin. */
export function EmailsPanel() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-6">
        <TabsTrigger value="overview">Které e-maily se posílají</TabsTrigger>
        {isAdmin && <TabsTrigger value="log">Odeslané e-maily</TabsTrigger>}
      </TabsList>
      <TabsContent value="overview">
        <Overview />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="log">
          <SentLog />
        </TabsContent>
      )}
    </Tabs>
  );
}

function Overview() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("companies")
      .select("email_settings")
      .eq("id", profile.company_id)
      .single()
      .then(({ data, error: e }) => {
        // Sloupec email_settings vzniká až po spuštění aktualizovaného schema.sql — do té doby je vše zapnuto.
        setSettings(e ? {} : ((data?.email_settings as Record<string, unknown> | null) ?? {}));
      });
  }, [profile]);

  async function toggle(key: EmailCategoryKey, enabled: boolean) {
    setBusy(key);
    setError(null);
    const previous = settings;
    setSettings({ ...(settings ?? {}), [key]: enabled });
    try {
      const { error: e } = await createClient().rpc("set_email_setting", { p_key: key, p_enabled: enabled });
      if (e) throw e;
    } catch (e) {
      setSettings(previous);
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (settings === null) return <LoadingLines rows={5} />;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-h2">Co Dodio posílá e-mailem</h2>
        <p className="mt-1 text-sm text-muted">
          Vypnutím se zastaví jen e-mail; upozornění v aplikaci (zvoneček) zůstávají. Každý zaměstnanec si navíc může e-mailová upozornění vypnout sám u zvonečku.
          {!isAdmin && " Přepínat můžete jen přehled pro HR a připomínky dovolené, ostatní nastavuje admin."}
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      {EMAIL_CATEGORIES.map((c) => {
        const enabled = isCategoryEnabled(settings, c.key);
        const canChange = isAdmin || c.hrCanChange;
        const templates = c.templates.map((k) => EMAIL_TEMPLATES.find((t) => t.key === k)).filter((t): t is (typeof EMAIL_TEMPLATES)[number] => !!t);
        return (
          <div key={c.key} className={cn("card p-5", !enabled && "bg-paper")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 font-medium">
                  {c.label}
                  {!enabled && <span className="rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning-dark">vypnuto</span>}
                </h3>
                <p className="mt-1 text-sm text-muted">{c.description}</p>
              </div>
              <Switch checked={enabled} disabled={!canChange || busy === c.key} onCheckedChange={(v) => toggle(c.key, v)} label={`E-maily: ${c.label}`} />
            </div>
            <ul className="mt-3 divide-y divide-line rounded border border-line text-sm">
              {templates.map((t) => (
                <li key={t.key} className="px-3 py-2">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted">
                    Komu: {t.to} · Kdy: {t.when}
                  </div>
                </li>
              ))}
            </ul>
            {!canChange && <p className="mt-2 text-xs text-muted">Nastavuje admin.</p>}
          </div>
        );
      })}

      <div className="card p-5">
        <h3 className="flex items-center gap-2 font-medium">
          <Bell size={15} className="text-muted" /> Provozní e-maily
        </h3>
        <p className="mt-1 text-sm text-muted">
          Pozvánky, uvítání, fakturace, změny podmínek a smazání dat jsou provozní a vypnout je nepůjde. Část z nich se zatím neposílá ({PLANNED_TEMPLATES.length} připravených šablon), rozjedou se s fakturací a s právními dokumenty.
        </p>
      </div>
    </div>
  );
}

const badgeClass: Record<EmailStatus, string> = {
  sent: "bg-teal-light text-teal-dark",
  pending: "bg-paper text-muted",
  retrying: "bg-warning-light text-warning-dark",
  failed: "bg-danger-light text-danger-dark",
};

function SentLog() {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "problem">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await createClient().rpc("email_log", { p_limit: 200 });
    if (e) {
      setError(errorMessage(e));
      setRows([]);
      return;
    }
    setRows((data as LogRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function retry(id: string) {
    setBusy(id);
    setError(null);
    try {
      const { error: e } = await createClient().rpc("retry_email", { p_id: id });
      if (e) throw e;
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const shown = (rows ?? []).filter((r) => filter === "all" || r.status !== "sent");
  const problems = (rows ?? []).filter((r) => r.status === "failed" || r.status === "retrying").length;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-h2">Odeslané e-maily</h2>
            <p className="mt-1 text-sm text-muted">
              Posledních 200 e-mailů firmy. Přehled záměrně neobsahuje text e-mailů, jen kdy a komu se poslal a jak dopadl — to stačí, když se někdo ptá, proč mu e-mail nedorazil.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded border border-line text-sm">
              {(["all", "problem"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5", filter === f ? "bg-teal-light font-medium text-teal-dark" : "text-muted hover:bg-paper")}>
                  {f === "all" ? "Všechny" : `Nevyřízené${problems > 0 ? ` (${problems})` : ""}`}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={load}>
              <RefreshCw size={14} /> Obnovit
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        {rows === null ? (
          <div className="p-5">
            <LoadingLines rows={5} />
          </div>
        ) : shown.length === 0 ? (
          <p className="p-5 text-sm text-muted">{filter === "problem" ? "Žádný e-mail nečeká ani neselhal." : "Zatím se neposlal žádný e-mail."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                  {["Kdy", "Komu", "Druh", "Předmět", "Stav", ""].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">{when(r.created_at)}</td>
                    <td className="px-3 py-2 text-xs">{r.to_email}</td>
                    <td className="px-3 py-2 text-xs">{categoryLabel(r.category)}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs" title={r.subject}>
                      {r.subject}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", badgeClass[r.status])}>
                        {r.status === "sent" ? <CheckCircle2 size={11} /> : r.status === "pending" ? <Clock size={11} /> : <AlertTriangle size={11} />}
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.error && <div className="mt-0.5 max-w-[14rem] truncate text-[11px] text-danger" title={r.error}>{r.error}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.status !== "sent" && (
                        <button
                          onClick={() => retry(r.id)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs hover:bg-paper disabled:opacity-50"
                        >
                          <RotateCcw size={11} /> Poslat znovu
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
