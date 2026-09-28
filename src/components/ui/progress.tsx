"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

/** Thin rounded progress bar (onboarding checklist, multi-step forms). `value` is 0–100. */
export function Progress({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <ProgressPrimitive.Root
      value={value}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-paper", className)}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full rounded-full bg-teal transition-all"
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
