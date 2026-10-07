"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Kontextové "⋯" menu u řádku tabulky — schová méně časté nebo riskantní akce (deaktivace, smazání), ať nejsou
 *  stálým tlačítkem hned vedle běžné akce (Upravit), kde se dá snadno splést jedno za druhé. */
export function RowMenu({ items, label = "Další akce" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-[0_8px_30px_rgba(22,35,59,0.16)]">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50",
                item.danger ? "text-danger-dark hover:bg-danger-light" : "text-ink hover:bg-paper"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
