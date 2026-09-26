/**
 * Po akci, která vytváří zprávu pro chat (nová žádost, schválení, zamítnutí, zrušení), popostrčí odesílání, ať zpráva
 * nečeká na plánovanou úlohu. Best-effort: selhání se ignoruje (zpráva se pošle při dalším průchodu úlohy).
 * Sloučí se víc volání těsně za sebou (hromadné schvalování).
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export function flushIntegrations() {
  if (typeof window === "undefined" || timer) return;
  timer = setTimeout(() => {
    timer = null;
    fetch("/api/integrations/flush", { method: "POST" }).catch(() => {});
  }, 800);
}

export interface FlushResult {
  events: number;
  delivered: number;
  failed: number;
  expired: number;
  lastError: string | null;
}

/** Ruční odeslání čekajících zpráv (tlačítko v Nastavení → Integrace) s výsledkem pro uživatele. */
export async function flushIntegrationsNow(): Promise<FlushResult> {
  const res = await fetch("/api/integrations/flush", { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Odeslání se nepodařilo.");
  return json as FlushResult;
}
