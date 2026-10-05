"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/utils";
import { getStepUpToken, platformFetch } from "./api";
import { RowAction } from "./RowActionsMenu";
import { inputClass, labelClass } from "./ui";

/**
 * „Náhled firmy (jen pro čtení)“ — samostatné tlačítko + modal, aby šlo spustit z detailu firmy i přímo z řádku
 * v seznamu (viz CompanyStatusActions a CompaniesPage). Vyžaduje důvod, délku a step-up token; po zahájení
 * přesměruje na /view/:id. `variant="menuItem"` vykreslí spouštěč jako položku menu (musí být uvnitř
 * RowActionsMenu) — jen řetězec, ne funkce, ať jde bez potíží použít i ze serverové stránky (RSC nesmí do
 * klientské komponenty poslat jako prop funkci).
 */
export function ImpersonateButton({ companyId, variant = "button" }: { companyId: string; variant?: "button" | "compact" | "menuItem" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function launch() {
    setError(null);
    setReason("");
    setNote("");
    setCode("");
    setOpen(true);
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const token = await getStepUpToken(`company.impersonate:${companyId}`, code);
      const r = await platformFetch<{ id: string }>(`/companies/${companyId}/impersonation`, { json: { reason, note, minutes }, headers: { "X-Step-Up-Token": token } });
      window.location.href = `/view/${r.id}`;
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      {variant === "menuItem" ? (
        <RowAction onSelect={(e) => { e.preventDefault(); launch(); }}>
          <Eye size={15} /> Náhled firmy (jen pro čtení)
        </RowAction>
      ) : variant === "compact" ? (
        <button onClick={launch} className="rounded p-1.5 text-muted hover:bg-paper hover:text-teal-dark" title="Náhled firmy (jen pro čtení)" aria-label="Náhled firmy (jen pro čtení)">
          <Eye size={16} />
        </button>
      ) : (
        <Button variant="secondary" onClick={launch}><Eye size={15} /> Náhled firmy (jen čtení)</Button>
      )}
      {open && (
        <DialogContent
          title="Náhled firmy (jen pro čtení)"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Zrušit</Button>
              <Button onClick={start} disabled={busy || reason.trim().length < 5 || code.replace(/\s/g, "").length !== 6}>{busy ? "Otevírám…" : "Zahájit náhled"}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">Uvidíte lidi, oddělení, nastavení a absence firmy. Nic nejde měnit a <strong>typ nemoci se nikdy nezobrazí</strong>. Správce firmy o náhledu dostane e-mail i s důvodem.</p>
            <div>
              <label className={labelClass} htmlFor="imp-reason">Důvod (uvidí ho zákazník)</label>
              <input id="imp-reason" className={inputClass} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. řešíme dotaz k nastavení schvalování" />
            </div>
            <div>
              <label className={labelClass} htmlFor="imp-note">Interní poznámka (nepovinné)</label>
              <input id="imp-note" className={inputClass} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="imp-min">Délka</label>
              <select id="imp-min" className={inputClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                <option value={15}>15 minut</option>
                <option value={30}>30 minut</option>
                <option value={60}>60 minut</option>
              </select>
            </div>
            <div className="rounded border border-line bg-paper/50 p-3">
              <label className={labelClass} htmlFor="imp-code">Kód TOTP z vaší aplikace</label>
              <input id="imp-code" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className={`${inputClass} font-mono tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
