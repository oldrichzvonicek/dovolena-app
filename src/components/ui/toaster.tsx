"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { TOAST_EVENT, type ToastDetail, type ToastTone } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Item extends ToastDetail {
  id: number;
}

const icon: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-dark" />,
  info: <Info size={18} className="mt-0.5 shrink-0 text-muted" />,
  error: <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />,
};

/** Zobrazuje potvrzení z showToast(); zmizí samo po pár vteřinách, jde zavřít a čtečky obrazovky ho oznámí. */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      const id = ++seq;
      setItems((cur) => [...cur.slice(-2), { id, ...detail }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), detail.tone === "error" ? 8000 : 5000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-[0_8px_30px_rgba(22,35,59,0.16)]",
            t.tone === "success" ? "border-teal/40" : t.tone === "error" ? "border-danger/40" : "border-line"
          )}
        >
          {icon[t.tone]}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} aria-label="Zavřít oznámení" className="text-muted hover:text-ink">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
