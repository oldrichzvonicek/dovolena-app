"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Jde zpátky v historii prohlížeče (zachová filtr/řazení/stránku seznamu, ze kterého admin přišel), místo aby
 * pevný odkaz vždy skočil na čistý seznam. Přímý vstup na stránku (bez historie) padá na `fallbackHref`.
 */
export function BackLink({ label, fallbackHref }: { label: string; fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}
