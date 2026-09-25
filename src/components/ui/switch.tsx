"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-teal-dark" : "bg-line"
      )}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-1")} />
    </button>
  );
}
