"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { ConfirmDialog, ConfirmWithNoteDialog } from "./ConfirmDialog";
import { platformFetch } from "./api";
import { inputClass, labelClass } from "./ui";

const todayLocal = () => new Date().toLocaleDateString("sv-SE");
/** Lhůta 30 dní od přijetí (stejný výpočet jako server, jen pro živý náhled ve formuláři). */
const dueDatePreview = (receivedAt: string) => {
  const d = new Date(`${receivedAt}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("cs-CZ");
};

export function NewDsrDialog({ companies, types }: { companies: { id: string; name: string; seq: number }[]; types: { key: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState(todayLocal());

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await platformFetch("/dsr", { json: { company_id: f.get("company_id"), type: f.get("type"), subject_label: f.get("subject_label"), received_at: f.get("received_at") } });
      setOpen(false);
      showToast("GDPR žádost byla založena.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => { setError(null); setOpen(true); }}><Plus size={16} /> Nová žádost</Button>
      {open && (
        <DialogContent title="Nová GDPR žádost" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Zrušit</Button><Button type="submit" form="dsr-form" disabled={busy}>{busy ? "Ukládám…" : "Založit"}</Button></div>}>
          <form id="dsr-form" onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="dsr-company">Firma, jejíž zaměstnance se žádost týká</label>
              <select id="dsr-company" name="company_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>Vyberte firmu…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name} (#{c.seq})</option>)}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="dsr-type">Typ žádosti</label>
                <select id="dsr-type" name="type" required className={inputClass}>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              </div>
              <div>
                <label className={labelClass} htmlFor="dsr-date">Přijato</label>
                <input id="dsr-date" name="received_at" type="date" required value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="dsr-label">Popisek žadatele (bez jména a osobních údajů)</label>
              <input id="dsr-label" name="subject_label" required minLength={3} maxLength={80} placeholder="např. zaměstnanec, oddělení Sklad" className={inputClass} />
              <p className="mt-1 text-caption text-muted">Nepoužívejte e-mail ani dlouhé číselné řady — jen obecný popis.</p>
            </div>
            <p className="text-caption text-muted">
              Lhůta na vyřízení je 30 dní od přijetí{dueDatePreview(receivedAt) && <> — vyjde na <strong className="text-ink">{dueDatePreview(receivedAt)}</strong></>}. Žádost se předá firmě, která je správcem údajů; Dodio ji jen eviduje a hlídá termín.
            </p>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function DsrRowActions({ id, status, canForward, canResolve }: { id: string; status: string; canForward: boolean; canResolve: boolean }) {
  const router = useRouter();
  const [confirmForward, setConfirmForward] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function forward() {
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/dsr/${id}/forward`, { json: {} });
      setConfirmForward(false);
      showToast("Žádost byla předána firmě.");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(note: string) {
    setBusy(true);
    setError(null);
    try {
      await platformFetch(`/dsr/${id}/resolve`, { json: { note } });
      setConfirmResolve(false);
      showToast("Žádost je vyřízená.");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      {canForward && status === "received" && (
        <Button variant="secondary" className="px-3 py-1.5" disabled={busy} onClick={() => { setError(null); setConfirmForward(true); }}>
          <Send size={14} /> Předat firmě
        </Button>
      )}
      {canResolve && status !== "resolved" && (
        <Button variant="secondary" className="px-3 py-1.5" disabled={busy} onClick={() => { setError(null); setConfirmResolve(true); }}>
          <CheckCircle2 size={14} /> Vyřízeno
        </Button>
      )}

      <ConfirmDialog
        open={confirmForward}
        onOpenChange={setConfirmForward}
        title="Předat žádost firmě"
        description="Správcům firmy odejde e-mail s výzvou k vyřízení, bez osobních údajů žadatele."
        confirmLabel="Předat firmě"
        busy={busy}
        error={error}
        onConfirm={forward}
      />
      <ConfirmWithNoteDialog
        open={confirmResolve}
        onOpenChange={setConfirmResolve}
        title="Označit jako vyřízené"
        description="Žádost se uzavře jako vyřízená."
        noteLabel="Poznámka k vyřízení (nepovinné, bez osobních údajů)"
        confirmLabel="Vyřízeno"
        busy={busy}
        error={error}
        onConfirm={resolve}
      />
    </div>
  );
}
