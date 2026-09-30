"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { HelpCircle, PlayCircle, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { faqsForRole } from "@/lib/help-content";
import { START_TOUR_EVENT } from "@/components/layout/ProductTour";
import { HelpFaqItem } from "@/components/shared/HelpFaqItem";

export const TOGGLE_HELP_EVENT = "dodio:toggle-help";

/** Slide-out quick help, openable from any page via the header "?" button. Mounted once in the app shell. */
export function HelpDrawer() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Escape-to-close is handled by Radix Dialog itself once open.
  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener(TOGGLE_HELP_EVENT, toggle);
    return () => window.removeEventListener(TOGGLE_HELP_EVENT, toggle);
  }, []);

  const faqs = useMemo(() => {
    const all = faqsForRole(profile?.role);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [profile?.role, query]);

  const searching = query.trim().length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-ink/30" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-[65] flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-[-8px_0_30px_rgba(22,35,59,0.16)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <DialogPrimitive.Title className="flex items-center gap-2 font-display text-h2">
            <HelpCircle size={18} className="text-teal-dark" /> Nápověda
          </DialogPrimitive.Title>
          <DialogPrimitive.Close aria-label="Zavřít" className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink">
            <X size={18} />
          </DialogPrimitive.Close>
        </div>
        <div className="space-y-3 border-b border-line p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat odpověď…" aria-label="Hledat odpověď"
              className="w-full rounded border border-line bg-white py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(START_TOUR_EVENT));
              }}
              className="flex items-center gap-1.5 text-teal-dark hover:underline"
            >
              <PlayCircle size={15} /> Spustit rychlého průvodce
            </button>
            <Link href="/help" onClick={() => setOpen(false)} className="text-muted hover:text-teal-dark">
              Celá nápověda →
            </Link>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {faqs.length === 0 && <p className="py-6 text-center text-sm text-muted">Nic jsme nenašli. Zkuste celou nápovědu a napište na HR.</p>}
          {faqs.map((f) => (
            <HelpFaqItem key={`${f.q}-${searching}`} faq={f} forceOpen={searching} />
          ))}
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
