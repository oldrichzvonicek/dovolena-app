"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { ADDONS, PLANS, planByKey } from "@/lib/plans";
import { changeKind, downgradeEffectiveDate, overLimitBy } from "@/lib/plan-change";
import { platformFetch } from "./api";
import { formatDate, formatDateTime } from "./format";
import { RowAction } from "./RowActionsMenu";
import { inputClass, labelClass } from "./ui";

export interface SubscriptionData {
  id: string;
  plan: string;
  addons: string[];
  billing_period: string;
  plan_paid_until: string | null;
  discount_pct: number;
  pending_plan: string | null;
  pending_plan_from: string | null;
  users: number;
}

const todayLocal = () => new Date().toLocaleDateString("sv-SE");

/** `variant="menuItem"` musí být uvnitř RowActionsMenu — jen řetězec, ne funkce (RSC nesmí do klientské komponenty poslat prop-funkci). */
export function SubscriptionDialog({ company, variant = "button" }: { company: SubscriptionData; variant?: "button" | "compact" | "menuItem" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(company.plan === "enterprise" ? "pro" : company.plan);
  const [period, setPeriod] = useState(company.billing_period);
  const [paidUntil, setPaidUntil] = useState(company.plan_paid_until ?? "");
  const [discount, setDiscount] = useState(String(company.discount_pct ?? 0));
  const [addons, setAddons] = useState<string[]>(company.addons ?? []);
  const [immediate, setImmediate] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = changeKind(company.plan, plan);
  const effective = kind === "downgrade" && !immediate && paidUntil ? downgradeEffectiveDate(paidUntil, todayLocal()) : null;
  const over = kind === "downgrade" ? overLimitBy(plan, company.users) : 0;

  function reset() {
    setPlan(company.plan === "enterprise" ? "pro" : company.plan);
    setPeriod(company.billing_period);
    setPaidUntil(company.plan_paid_until ?? "");
    setDiscount(String(company.discount_pct ?? 0));
    setAddons(company.addons ?? []);
    setImmediate(false);
    setCancelPending(false);
    setReason("");
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/companies/${company.id}/subscription`, {
        method: "PATCH",
        json: { plan, billing_period: period, plan_paid_until: paidUntil || null, discount_pct: Number(discount.replace(",", ".")), addons, immediate, cancel_pending: cancelPending, reason },
      });
      setOpen(false);
      showToast("Předplatné bylo změněno.");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      {variant === "menuItem" ? (
        <RowAction onSelect={(e) => { e.preventDefault(); openDialog(); }}>
          <Pencil size={15} /> Změnit tarif
        </RowAction>
      ) : variant === "compact" ? (
        <button onClick={openDialog} className="rounded p-1.5 text-muted hover:bg-paper hover:text-teal-dark" title="Změnit tarif" aria-label="Změnit tarif">
          <Pencil size={16} />
        </button>
      ) : (
        <Button variant="secondary" onClick={openDialog}>
          <Pencil size={15} /> Změnit tarif
        </Button>
      )}
      {open && (
        <DialogContent
          title="Změna předplatného"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Zrušit</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Ukládám…" : "Uložit změnu"}</Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="sub-plan">Tarif</label>
                <select id="sub-plan" className={inputClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
                  {PLANS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="sub-period">Fakturační období</label>
                <select id="sub-period" className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="monthly">Měsíční</option>
                  <option value="yearly">Roční</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="sub-paid">Zaplaceno do (poslední zaplacený den)</label>
                <input id="sub-paid" type="date" className={inputClass} value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="sub-discount">Sleva (%)</label>
                <input id="sub-discount" inputMode="decimal" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>

            <fieldset>
              <legend className={labelClass}>Doplňky</legend>
              <div className="space-y-1.5">
                {ADDONS.map((a) => {
                  const included = a.includedIn.includes(planByKey(plan).key);
                  return (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={addons.includes(a.key)} onChange={(e) => setAddons((cur) => (e.target.checked ? [...cur, a.key] : cur.filter((x) => x !== a.key)))} />
                      {a.name}
                      <span className="text-caption text-muted">{included ? "v ceně tarifu" : `${a.monthly} Kč / měsíc`}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {kind === "upgrade" && <p className="rounded bg-teal-light px-3 py-2 text-sm text-teal-dark">Zvýšení tarifu platí <strong>hned</strong>. Doplatek a kredit vyřeší faktura.</p>}
            {kind === "downgrade" && (
              <div className="space-y-2 rounded bg-warning-light px-3 py-2 text-sm text-warning-dark">
                {effective ? (
                  <p>Snížení se podle podmínek projeví <strong>až od {formatDate(effective)}</strong> (den po zaplaceném období), peníze se nevrací. Do té doby firma používá původní tarif.</p>
                ) : (
                  <p>Bez zaplaceného období se snížení provede <strong>okamžitě</strong>.</p>
                )}
                {over > 0 && <p>Firma má o {over} aktivních uživatelů více, než nový tarif dovoluje. Stávající zůstanou, další nepůjde přidat.</p>}
                {paidUntil && (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} /> Výjimečně použít ihned
                  </label>
                )}
              </div>
            )}
            {company.pending_plan && (
              <label className="flex items-start gap-2 rounded border border-line px-3 py-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={cancelPending} onChange={(e) => setCancelPending(e.target.checked)} />
                <span>Zrušit naplánovanou změnu na {planByKey(company.pending_plan).name} od {formatDate(company.pending_plan_from)}</span>
              </label>
            )}

            <div>
              <label className={labelClass} htmlFor="sub-reason">Důvod (uloží se do audit logu)</label>
              <input id="sub-reason" maxLength={300} className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. dohoda se zákazníkem, sleva pro neziskovku" />
            </div>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export interface NoteData {
  id: string;
  author_label: string | null;
  body: string;
  created_at: string;
}

export function NotesPanel({ companyId, notes, canWrite }: { companyId: string; notes: NoteData[]; canWrite: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/companies/${companyId}/notes`, { json: { body: text } });
      setText("");
      showToast("Poznámka byla přidána.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canWrite && (
        <form onSubmit={add} className="mb-4 space-y-2">
          <label className={labelClass} htmlFor="note-body">Nová poznámka</label>
          <textarea id="note-body" rows={3} maxLength={4000} className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="Interní poznámka pro tým Dodio. Nepište sem osobní ani zdravotní údaje zaměstnanců." />
          {error && <p role="alert" className="text-sm text-danger-dark">{error}</p>}
          <Button type="submit" variant="secondary" disabled={busy || !text.trim()}>{busy ? "Ukládám…" : "Přidat poznámku"}</Button>
        </form>
      )}
      {notes.length === 0 ? (
        <p className="text-sm text-muted">Zatím žádné poznámky.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-line/70 bg-paper/50 px-3 py-2">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 text-caption text-muted">{n.author_label ?? "neznámý"} · {formatDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
