"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, BellRing, CheckCircle2, FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { RowAction, RowActionsMenu } from "./RowActionsMenu";
import { platformFetch } from "./api";
import { INVOICE_STATUS, formatDate, formatKc } from "./format";
import { Empty, Pill, inputClass, labelClass, tableClass, tdClass, thClass } from "./ui";

export interface InvoiceItem {
  id: string;
  number: string;
  company_id: string;
  companyName?: string;
  companySeq?: number;
  issue_date: string;
  due_at: string | null;
  paid_at: string | null;
  amount: number;
  vat: number;
  status: "issued" | "paid" | "void";
  hasFile: boolean;
  overdue: boolean;
  /** Navržená nová platnost tarifu po zaplacení (jen pro platící tarify). */
  suggestExtend: string | null;
}

const todayLocal = () => new Date().toLocaleDateString("sv-SE");

export function InvoicesTable({ invoices, canWrite, showCompany }: { invoices: InvoiceItem[]; canWrite: boolean; showCompany?: boolean }) {
  const router = useRouter();
  const [confirmRemind, setConfirmRemind] = useState<InvoiceItem | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<InvoiceItem | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<InvoiceItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openFile(id: string, number: string) {
    try {
      const r = await platformFetch<{ url: string }>(`/invoices/${id}/file`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      showToast(errorMessage(e) || `PDF faktury ${number} se nepodařilo otevřít.`, "error");
    }
  }

  async function remind() {
    if (!confirmRemind) return;
    setBusy(true);
    setError(null);
    try {
      const r = await platformFetch<{ sent: number }>(`/invoices/${confirmRemind.id}/remind`, { method: "POST", json: {} });
      setConfirmRemind(null);
      showToast(r.sent > 0 ? `Upomínka k faktuře ${confirmRemind.number} je ve frontě (${r.sent} příjemců).` : "Firma nemá žádný e-mail, upomínka se neodeslala.", r.sent > 0 ? "success" : "info");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function voidInvoice() {
    if (!confirmVoid) return;
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/invoices/${confirmVoid.id}/void`, { method: "POST", json: {} });
      setConfirmVoid(null);
      showToast(`Faktura ${confirmVoid.number} byla stornována.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (invoices.length === 0) return <Empty>Žádné faktury.</Empty>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Číslo</th>
              {showCompany && <th className={thClass}>Firma</th>}
              <th className={thClass}>Vystaveno</th>
              <th className={thClass}>Splatnost</th>
              <th className={`${thClass} text-right`}>Částka</th>
              <th className={thClass}>Stav</th>
              <th className={thClass}><span className="sr-only">Akce</span></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const st = inv.overdue ? { label: "Po splatnosti", className: "bg-danger-light text-danger-dark" } : INVOICE_STATUS[inv.status];
              return (
                <tr key={inv.id}>
                  <td className={`${tdClass} font-medium tabular-nums`}>{inv.number}</td>
                  {showCompany && (
                    <td className={tdClass}>
                      <Link href={`/companies/${inv.company_id}`} className="text-teal-dark hover:underline">{inv.companyName ?? "Firma"}</Link>
                      {inv.companySeq !== undefined && <span className="ml-1.5 text-caption text-muted">#{inv.companySeq}</span>}
                    </td>
                  )}
                  <td className={`${tdClass} whitespace-nowrap`}>{formatDate(inv.issue_date)}</td>
                  <td className={`${tdClass} whitespace-nowrap`}>{inv.status === "paid" ? <span className="text-muted">zaplaceno {formatDate(inv.paid_at)}</span> : formatDate(inv.due_at)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatKc(inv.amount)}</td>
                  <td className={tdClass}><Pill className={st.className}>{st.label}</Pill></td>
                  <td className={`${tdClass} text-right`}>
                    {(inv.hasFile || (canWrite && inv.status === "issued")) && (
                      <RowActionsMenu label={`Akce k faktuře ${inv.number}`}>
                        {inv.hasFile && (
                          <RowAction onSelect={() => openFile(inv.id, inv.number)}>
                            <FileDown size={15} /> Otevřít PDF
                          </RowAction>
                        )}
                        {canWrite && inv.status === "issued" && (
                          <RowAction onSelect={() => setConfirmRemind(inv)}>
                            <BellRing size={15} /> Poslat upomínku
                          </RowAction>
                        )}
                        {canWrite && inv.status === "issued" && (
                          <RowAction onSelect={() => setPayingInvoice(inv)}>
                            <CheckCircle2 size={15} /> Označit jako zaplacené
                          </RowAction>
                        )}
                        {canWrite && inv.status === "issued" && (
                          <RowAction danger onSelect={() => setConfirmVoid(inv)}>
                            <Ban size={15} /> Stornovat
                          </RowAction>
                        )}
                      </RowActionsMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmRemind}
        onOpenChange={(o) => !o && setConfirmRemind(null)}
        title="Poslat upomínku"
        description={confirmRemind ? `Firmě odejde e-mail s upomínkou k faktuře ${confirmRemind.number}. Jde poslat nejvýš jednou za 24 hodin.` : ""}
        confirmLabel="Poslat upomínku"
        busy={busy}
        error={error}
        onConfirm={remind}
      />
      <ConfirmDialog
        open={!!confirmVoid}
        onOpenChange={(o) => !o && setConfirmVoid(null)}
        title="Stornovat fakturu"
        description={confirmVoid ? `Opravdu stornovat fakturu ${confirmVoid.number}? Doklad zůstane v evidenci se stavem Storno.` : ""}
        confirmLabel="Stornovat"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={voidInvoice}
      />
      {payingInvoice && <MarkPaidDialog invoice={payingInvoice} onClose={() => setPayingInvoice(null)} />}
    </div>
  );
}

function MarkPaidDialog({ invoice, onClose }: { invoice: InvoiceItem; onClose: () => void }) {
  const router = useRouter();
  const [receivedAt, setReceivedAt] = useState(todayLocal());
  const [extend, setExtend] = useState(!!invoice.suggestExtend);
  const [extendUntil, setExtendUntil] = useState(invoice.suggestExtend ?? "");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/invoices/${invoice.id}/paid`, { json: { received_at: receivedAt, extend_until: extend && extendUntil ? extendUntil : undefined, provider_ref: ref || undefined } });
      onClose();
      showToast(`Faktura ${invoice.number} je označená jako zaplacená.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Zaplaceno: faktura ${invoice.number}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Zrušit</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Ukládám…" : "Označit jako zaplacené"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">Částka {formatKc(invoice.amount)}{invoice.companyName ? ` · ${invoice.companyName}` : ""}</p>
          <div>
            <label className={labelClass} htmlFor="paid-date">Datum přijetí platby</label>
            <input id="paid-date" type="date" className={inputClass} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="paid-ref">Variabilní symbol nebo poznámka k platbě (nepovinné)</label>
            <input id="paid-ref" maxLength={100} className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          {invoice.suggestExtend && (
            <div className="rounded border border-line px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={extend} onChange={(e) => setExtend(e.target.checked)} /> Prodloužit platnost tarifu
              </label>
              {extend && (
                <div className="mt-2">
                  <label className={labelClass} htmlFor="paid-until">Nově zaplaceno do</label>
                  <input id="paid-until" type="date" className={inputClass} value={extendUntil} onChange={(e) => setExtendUntil(e.target.value)} />
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewInvoiceDialog({ companies, fixedCompany }: { companies?: { id: string; name: string; seq: number }[]; fixedCompany?: { id: string; name: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (fixedCompany) form.set("company_id", fixedCompany.id);
    setBusy(true);
    setError(null);
    try {
      const r = await platformFetch<{ number: string }>("/invoices", { form });
      setOpen(false);
      showToast(`Faktura ${r.number} byla vystavena.`);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => { setError(null); setOpen(true); }}>
        <Plus size={16} /> Nová faktura
      </Button>
      {open && (
        <DialogContent title="Nová faktura" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Zrušit</Button><Button type="submit" form="new-invoice-form" disabled={busy}>{busy ? "Ukládám…" : "Vystavit"}</Button></div>}>
          <form id="new-invoice-form" onSubmit={submit} className="space-y-4">
            {fixedCompany ? (
              <p className="text-sm">Firma: <strong>{fixedCompany.name}</strong></p>
            ) : (
              <div>
                <label className={labelClass} htmlFor="inv-company">Firma</label>
                <select id="inv-company" name="company_id" required className={inputClass} defaultValue="">
                  <option value="" disabled>Vyberte firmu…</option>
                  {(companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.seq})</option>)}
                </select>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="inv-number">Číslo faktury</label>
                <input id="inv-number" name="number" maxLength={30} placeholder="automaticky další v řadě" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-amount">Částka celkem vč. DPH (Kč)</label>
                <input id="inv-amount" name="amount" required inputMode="decimal" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-issue">Vystaveno</label>
                <input id="inv-issue" name="issue_date" type="date" defaultValue={todayLocal()} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-due">Splatnost</label>
                <input id="inv-due" name="due_at" type="date" required defaultValue={new Date(Date.now() + 14 * 86_400_000).toLocaleDateString("sv-SE")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-vat">z toho DPH (Kč)</label>
                <input id="inv-vat" name="vat" inputMode="decimal" defaultValue="0" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="inv-file">PDF faktury (nepovinné, max. 5 MB)</label>
                <input id="inv-file" name="file" type="file" accept="application/pdf" className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-paper file:px-2 file:py-1`} />
              </div>
            </div>
            <p className="text-caption text-muted">Do faktury se uloží kopie fakturačních údajů odběratele, aby doklad zůstal úplný i po smazání firmy.</p>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
