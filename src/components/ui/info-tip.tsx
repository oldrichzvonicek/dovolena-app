"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Malá informační ikonka; text se ukáže po kliknutí (funguje i na mobilu a z klávesnice). */
export function InfoTip({ text, label = "Více informací" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  // Pevné "left-0" umělo zajet mimo obrazovku (a protáhnout celý dialog do vodorovného scrollu), když byla
  // ikonka blízko pravého okraje — viz dlouhý nadpis v Importu zaměstnanců. Při otevření se podle zbývajícího
  // místa doprava rozhodne, jestli se bublina zarovná doleva (výchozí) nebo doprava od ikonky.
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const tooltipWidth = window.innerWidth >= 640 ? 320 : 256; // odpovídá w-64 / sm:w-80 níž
    setAlignRight(rect.left + tooltipWidth > window.innerWidth - 16);
  }, [open]);

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

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full text-muted hover:text-teal-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
      >
        <Info size={15} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute top-6 z-30 w-64 rounded border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-lg sm:w-80",
            alignRight ? "right-0" : "left-0"
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
