"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { platformFetch } from "./api";
import { inputClass, labelClass } from "./ui";

export function NewLegalDocumentDialog({ types }: { types: { key: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await platformFetch("/legal-documents", { form });
      setOpen(false);
      showToast("Nová verze dokumentu byla uložena.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => { setError(null); setOpen(true); }}><Plus size={16} /> Nová verze</Button>
      {open && (
        <DialogContent title="Nová verze dokumentu" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Zrušit</Button><Button type="submit" form="legal-form" disabled={busy}>{busy ? "Ukládám…" : "Uložit"}</Button></div>}>
          <form id="legal-form" onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="lg-type">Dokument</label>
                <select id="lg-type" name="type" required className={inputClass}>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
              </div>
              <div>
                <label className={labelClass} htmlFor="lg-version">Verze</label>
                <input id="lg-version" name="version" required maxLength={30} placeholder="např. 2026-10" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lg-date">Účinnost od</label>
                <input id="lg-date" name="effective_from" type="date" required defaultValue={new Date().toLocaleDateString("sv-SE")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="lg-file">PDF (max. 10 MB)</label>
                <input id="lg-file" name="file" type="file" accept="application/pdf" className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-paper file:px-2 file:py-1`} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="lg-note">Co se změnilo (nepovinné)</label>
              <input id="lg-note" name="note" maxLength={500} className={inputClass} />
            </div>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function LegalFileLink({ id }: { id: string }) {
  async function open() {
    try {
      const r = await platformFetch<{ url: string }>(`/legal-documents/${id}/file`);
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      showToast(errorMessage(e), "error");
    }
  }
  return (
    <button onClick={open} className="inline-flex items-center gap-1 text-teal-dark hover:underline"><FileDown size={14} /> PDF</button>
  );
}
