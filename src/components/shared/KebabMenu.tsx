"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KebabItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

/** "•••" menu. The list is position:fixed so it isn't clipped by scrolling table wrappers. */
export function KebabMenu({ items, label = "Další akce", icon, className }: { items: KebabItem[]; label?: string; icon?: React.ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={() => {
          if (pos) return setPos(null);
          const r = btnRef.current!.getBoundingClientRect();
          setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
        }}
        className={className ?? "rounded border border-line p-1.5 text-muted hover:bg-paper hover:text-ink"}
      >
        {icon ?? <MoreHorizontal size={14} />}
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-50 min-w-[190px] rounded-lg border border-line bg-white py-1 shadow-[0_8px_30px_rgba(22,35,59,0.14)]"
          style={{ top: pos.top, right: pos.right }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              onClick={() => {
                setPos(null);
                it.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper",
                it.danger ? "text-danger-dark" : "text-ink"
              )}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
