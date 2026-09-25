"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className, children, "aria-label": ariaLabel }: { className?: string; children: React.ReactNode; "aria-label"?: string }) {
  return (
    <SelectPrimitive.Trigger
      aria-label={ariaLabel}
      className={cn(
        "flex w-full items-center justify-between rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal",
        className
      )}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown size={16} className="text-muted" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="z-50 overflow-hidden rounded border border-line bg-white shadow-[0_8px_30px_rgba(22,35,59,0.12)]">
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ value, children, disabled }: { value: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className="flex cursor-pointer data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 items-center justify-between rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-paper"
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check size={14} className="text-teal-dark" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
