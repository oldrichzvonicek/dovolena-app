"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { errorMessage } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

/** Settings save automatically on change/blur — this makes that visible instead of silent. */
export function useSaveStatus() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    clearTimeout(timer.current);
    setStatus("saving");
    setError(null);
    try {
      await fn();
      setStatus("saved");
      timer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch (e) {
      setError(errorMessage(e));
      setStatus("error");
    }
  }, []);

  return { status, error, run };
}

export function SaveStatusBar({ status, error }: { status: Status; error: string | null }) {
  return (
    <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end" aria-live="polite">
      {status === "idle" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs text-muted shadow-sm backdrop-blur">
          <Check size={12} className="text-teal-dark" /> Změny se ukládají automaticky
        </div>
      )}
      {status === "saving" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm text-muted shadow-[0_8px_30px_rgba(22,35,59,0.14)]">
          <Loader2 size={14} className="animate-spin" /> Ukládám…
        </div>
      )}
      {status === "saved" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-teal/30 bg-teal-light px-4 py-2 text-sm text-teal-dark shadow-[0_8px_30px_rgba(22,35,59,0.14)]">
          <Check size={14} /> Změna uložena
        </div>
      )}
      {status === "error" && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-danger/30 bg-danger-light px-4 py-2 text-sm text-danger-dark shadow-[0_8px_30px_rgba(22,35,59,0.14)]">
          <AlertTriangle size={14} /> Uložení se nezdařilo{error ? `: ${error}` : ""}
        </div>
      )}
    </div>
  );
}
