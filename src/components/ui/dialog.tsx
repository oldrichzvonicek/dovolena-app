"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-ink/30 z-40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-line bg-white p-6 shadow-[0_8px_30px_rgba(22,35,59,0.12)]",
          className
        )}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <DialogPrimitive.Title className="font-display text-xl">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded p-1 text-muted hover:bg-paper" aria-label="Zavřít">
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
