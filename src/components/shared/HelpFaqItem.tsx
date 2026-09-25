"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { submitHelpFeedback } from "@/lib/help-feedback";
import type { HelpFaq } from "@/lib/help-content";

/** One FAQ entry with 👍/👎. forceOpen shows the answer immediately (used while searching). */
export function HelpFaqItem({ faq, forceOpen }: { faq: HelpFaq; forceOpen?: boolean }) {
  const { profile } = useAuth();
  const [rated, setRated] = useState<null | "ok" | "error">(null);

  async function rate(helpful: boolean) {
    if (!profile) return;
    try {
      await submitHelpFeedback(profile.id, faq.q, helpful);
      setRated("ok");
    } catch {
      setRated("error");
    }
  }

  return (
    <details open={forceOpen || undefined} className="group card p-4">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-body-strong text-ink marker:content-none">
        {faq.q}
        <span className="mt-0.5 shrink-0 text-lg leading-none text-muted transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 text-sm text-muted">{faq.a}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        {rated === "ok" ? (
          <span>Díky za zpětnou vazbu!</span>
        ) : rated === "error" ? (
          <span>Hodnocení se nepodařilo uložit.</span>
        ) : (
          <>
            <span>Pomohla vám tato odpověď?</span>
            <button onClick={() => rate(true)} aria-label="Ano, pomohla" className="rounded p-1 hover:bg-teal-light hover:text-teal-dark">
              <ThumbsUp size={14} />
            </button>
            <button onClick={() => rate(false)} aria-label="Ne, nepomohla" className="rounded p-1 hover:bg-danger-light hover:text-danger">
              <ThumbsDown size={14} />
            </button>
          </>
        )}
      </div>
    </details>
  );
}
