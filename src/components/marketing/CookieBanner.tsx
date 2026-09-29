"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dodio-cookie-consent";

// Purely decorative for now — no analytics tool is wired in yet, so there's
// nothing this banner actually gates. It exists so the page isn't missing
// one once real analytics does get added.
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore — worst case the banner reappears next visit
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-dodio-border bg-dodio-surface-card font-dodio-sans">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10 lg:px-[120px]">
        <p className="m-0 text-sm text-dodio-ink-muted">
          Tento web používá cookies, aby fungoval a abychom mohli měřit návštěvnost.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="w-full shrink-0 rounded-dodio-md bg-dodio-teal-dark px-5 py-2.5 text-sm font-semibold text-white sm:w-auto"
        >
          Rozumím
        </button>
      </div>
    </div>
  );
}
