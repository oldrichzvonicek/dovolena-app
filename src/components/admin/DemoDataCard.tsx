"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { emitDataChanged } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { errorMessage } from "@/lib/utils";

async function call(action: "status" | "create" | "remove") {
  const res = await fetch("/api/admin/demo-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Požadavek selhal.");
  return json as { exists?: boolean; people?: number; requests?: number; removed?: number };
}

/** Ukázková data (jen admin): fiktivní oddělení, lidé a absence k prohlédnutí aplikace; jedním kliknutím se odstraní. */
export function DemoDataCard() {
  const { profile } = useAuth();
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    call("status")
      .then((r) => setExists(!!r.exists))
      .catch(() => setExists(null));
  }, [profile]);

  if (!profile || profile.role !== "admin" || exists === null) return null;

  async function run(action: "create" | "remove") {
    setBusy(true);
    setMessage(null);
    try {
      const r = await call(action);
      setExists(action === "create");
      setConfirmRemove(false);
      setMessage({
        ok: true,
        text: action === "create" ? `Hotovo: přibylo ${r.people} lidí a ${r.requests} absencí. Projděte kalendář, Analytiku a Ke schválení.` : `Ukázková data jsou pryč (${r.removed} lidí).`,
      });
      emitDataChanged();
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-light text-violet-dark">
            <FlaskConical size={15} />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-display text-h2">
              Ukázková data
              <InfoTip
                label="Co jsou ukázková data"
                text="Přidá tři fiktivní oddělení, 14 fiktivních lidí a jejich absence (dovolená, home office, lékař, nemoc, čekající žádosti i kapacitní kolizi), abyste si prohlédli kalendář, Analytiku a schvalování dřív, než pozvete skutečné kolegy. Ukázkoví lidé se nemohou přihlásit, nedostávají žádné e-maily a nepočítají se do limitu tarifu. Jedním kliknutím se odstraní."
              />
            </h2>
            <p className="mt-1 text-sm text-muted">
              {exists ? "Ve firmě jsou ukázkoví lidé a absence. Až si aplikaci prohlédnete, odstraňte je." : "Prohlédněte si Dodio naplněné fiktivními daty, než pozvete skutečné kolegy."}
            </p>
          </div>
        </div>
        {exists ? (
          confirmRemove ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">Opravdu odstranit?</span>
              <Button variant="danger" onClick={() => run("remove")} disabled={busy}>
                {busy ? "Odstraňuji…" : "Ano, odstranit"}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmRemove(false)} disabled={busy}>
                Zpět
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmRemove(true)}>
              Odstranit ukázková data
            </Button>
          )
        ) : (
          <Button variant="secondary" onClick={() => run("create")} disabled={busy}>
            {busy ? "Vytvářím…" : "Přidat ukázková data"}
          </Button>
        )}
      </div>
      {message && <p className={message.ok ? "mt-3 text-sm text-teal-dark" : "mt-3 text-sm text-danger"}>{message.text}</p>}
    </div>
  );
}
