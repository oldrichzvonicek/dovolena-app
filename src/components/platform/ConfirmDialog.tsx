"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { inputClass, labelClass } from "./ui";

/**
 * Nahrazuje window.confirm/window.prompt vlastním dialogem, ať vzhled i chování akcí sedí se zbytkem adminu.
 * Ovládá se zvenčí (open/onOpenChange), aby volající mohl po potvrzení sám dokončit akci a zavřít dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Potvrdit",
  cancelLabel = "Zrušit",
  tone = "default",
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent
          title={title}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>{cancelLabel}</Button>
              <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>{busy ? "Chvilku…" : confirmLabel}</Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <div className="text-ink">{description}</div>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Stejné jako ConfirmDialog, ale s volitelným textovým polem (nahrazuje window.prompt) — hodnota jde do onConfirm. */
export function ConfirmWithNoteDialog({
  open,
  onOpenChange,
  title,
  description,
  noteLabel,
  confirmLabel = "Potvrdit",
  busy,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  noteLabel: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setNote("");
      }}
    >
      {open && (
        <DialogContent
          title={title}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Zrušit</Button>
              <Button onClick={() => onConfirm(note)} disabled={busy}>{busy ? "Ukládám…" : confirmLabel}</Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-ink">{description}</p>
            <div>
              <label className={labelClass} htmlFor="confirm-note">{noteLabel}</label>
              <textarea id="confirm-note" rows={3} maxLength={500} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
