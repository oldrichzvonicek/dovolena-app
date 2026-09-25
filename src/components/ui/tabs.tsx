"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <TabsPrimitive.List className={cn("flex gap-5 border-b border-line", className)}>{children}</TabsPrimitive.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-teal data-[state=active]:text-teal-dark"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
