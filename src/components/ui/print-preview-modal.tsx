"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Náhled před tiskem: obsah uvnitř je přesně to, co se vytiskne (na obrazovce jde vidět dřív, než se otevře
 * systémové dialogové okno tisku). Hlavička s tlačítky má `no-print`, takže při tisku zůstane jen samotný obsah,
 * bez rámečku a stínu okna — proto komponenta nejde postavit na sdíleném `DialogContent` (ten hlavičku ani
 * pozicování nejde vypnout) a má vlastní, tiskem ovlivnitelné třídy.
 */
export function PrintPreviewModal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="no-print fixed inset-0 z-40 bg-ink/30" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-line bg-surface shadow-[0_8px_30px_rgba(22,35,59,0.16)]",
            "print:static print:z-auto print:m-0 print:h-auto print:max-h-none print:w-auto print:max-w-none print:translate-x-0 print:translate-y-0 print:rounded-none print:border-0 print:shadow-none"
          )}
        >
          <div className="no-print flex shrink-0 items-center justify-between gap-3 border-b border-line p-4">
            <DialogPrimitive.Title className="font-display text-lg">{title}</DialogPrimitive.Title>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded bg-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-dark"
              >
                <Printer size={15} /> Tisk
              </button>
              <DialogPrimitive.Close className="rounded p-2 text-muted hover:bg-paper" aria-label="Zavřít">
                <X size={18} />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 print:overflow-visible print:p-0 sm:p-6 print:sm:p-0">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
