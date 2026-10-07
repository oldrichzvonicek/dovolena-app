"use client";

import { Button } from "@/components/ui/button";

/** Spodní lišta pro useCompanyDraft — zobrazí se jen při neuložené změně. */
export function DraftSaveBar({
  dirty,
  status,
  error,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 shadow-[0_8px_30px_rgba(22,35,59,0.16)]">
      <span className="text-sm text-muted">{status === "error" ? <span className="text-danger">Uložení se nezdařilo{error ? `: ${error}` : ""}</span> : "Neuložené změny"}</span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={status === "saving"}>
          Zrušit
        </Button>
        <Button variant="primary" onClick={onSave} disabled={status === "saving"}>
          {status === "saving" ? "Ukládám…" : "Uložit změny"}
        </Button>
      </div>
    </div>
  );
}
