"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { platformFetch } from "./api";

export function RunJobsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await platformFetch<{ jobs: { ran: number; done: number; failed: number }; dunning: { reminders: number; suspended: number }; activityUpdated: number }>("/jobs/run", { method: "POST", json: {} });
      setMessage(`Zpracováno úloh: ${r.jobs.ran} (hotovo ${r.jobs.done}, selhalo ${r.jobs.failed}). Upomínky: ${r.dunning.reminders}, pozastaveno firem: ${r.dunning.suspended}. Aktualizovaná aktivita: ${r.activityUpdated} firem.`);
      router.refresh();
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={run} disabled={busy}><Play size={15} /> {busy ? "Běží…" : "Spustit teď"}</Button>
      {message && <span role="status" className="max-w-sm text-right text-caption text-muted">{message}</span>}
    </div>
  );
}

export function DownloadExportButton({ jobId }: { jobId: string }) {
  async function download() {
    try {
      const r = await platformFetch<{ downloadUrl: string | null }>(`/jobs/${jobId}`);
      if (r.downloadUrl) window.location.href = r.downloadUrl;
      else showToast("Soubor už není dostupný.", "error");
    } catch (e) {
      showToast(errorMessage(e), "error");
    }
  }
  return <button onClick={download} className="inline-flex items-center gap-1 text-teal-dark hover:underline"><Download size={14} /> Stáhnout ZIP</button>;
}
