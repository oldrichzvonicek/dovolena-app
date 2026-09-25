"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const EVENT = "dodio:confirm";

interface Request {
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/** Styled, keyboard-accessible replacement for window.confirm(). Usage: `if (!(await confirmDialog("…"))) return;` */
export function confirmDialog(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<Request>(EVENT, { detail: { message, confirmLabel: opts.confirmLabel ?? "Potvrdit", danger: opts.danger ?? false, resolve } })
    );
  });
}

/** Mounted once in the app shell. */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setReq((e as CustomEvent<Request>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  function close(ok: boolean) {
    req?.resolve(ok);
    setReq(null);
  }

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && close(false)}>
      <DialogContent title="Potvrďte akci">
        <p className="text-sm text-muted">{req?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            Zrušit
          </Button>
          <Button variant={req?.danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
            {req?.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
