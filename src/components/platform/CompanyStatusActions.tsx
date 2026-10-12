"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { ConfirmDialog } from "./ConfirmDialog";
import { ImpersonateButton } from "./ImpersonateButton";
import { getStepUpToken, platformFetch } from "./api";
import { formatDate } from "./format";
import { inputClass, labelClass } from "./ui";

export interface StatusActionsProps {
  companyId: string;
  companyName: string;
  status: "active" | "suspended" | "pending_deletion" | "deleted";
  deletionScheduledAt: string | null;
  deletionReason: string | null;
  can: { suspend: boolean; delete: boolean; impersonate: boolean; export: boolean };
}

type Modal = null | "suspend" | "delete" | "restore";

export function CompanyStatusActions(p: StatusActionsProps) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [typedName, setTypedName] = useState("");
  const [notify, setNotify] = useState(true);

  const open = (m: Modal) => {
    setModal(m);
    setError(null);
    setReason("");
    setCode("");
    setTypedName("");
    setNotify(true);
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const simple = (path: string, json: unknown, message?: string) =>
    run(async () => {
      await platformFetch(path, { method: path.endsWith("/deletion") ? "DELETE" : "POST", json });
      setModal(null);
      if (message) showToast(message);
      router.refresh();
    });

  const suspend = () => simple(`/companies/${p.companyId}/suspend`, { reason, notify }, "Účet firmy je pozastaven.");
  const unsuspend = () =>
    run(async () => {
      await platformFetch(`/companies/${p.companyId}/unsuspend`, { json: {} });
      showToast("Provoz firmy byl obnoven.");
      router.refresh();
    });
  const restore = () => simple(`/companies/${p.companyId}/deletion`, {}, "Firma byla obnovena.");
  const exportData = () =>
    run(async () => {
      await platformFetch(`/companies/${p.companyId}/export`, { json: { notify_owner: false } });
      showToast("Export je ve frontě. Stav a stažení najdete na stránce Úlohy.");
    });

  const del = () =>
    run(async () => {
      const token = await getStepUpToken(`company.delete:${p.companyId}`, code);
      await platformFetch(`/companies/${p.companyId}/deletion`, { json: { reason, notify_owner: notify }, headers: { "X-Step-Up-Token": token } });
      setModal(null);
      showToast("Smazání firmy bylo naplánováno za 30 dní.");
      router.refresh();
    });

  const locked = p.status === "pending_deletion" || p.status === "deleted";
  if (p.status === "deleted") return <p className="text-sm text-muted">Firma je smazaná. Zůstal jen náhrobek s fakturami a auditem.</p>;

  return (
    <div className="space-y-4">
      {p.status === "pending_deletion" && (
        <div className="rounded border border-danger/40 bg-danger-light px-3 py-3 text-sm text-danger-dark">
          <strong>Firma je naplánovaná ke smazání dne {formatDate(p.deletionScheduledAt)}.</strong> Zákazníci se nemohou přihlásit.
          {p.deletionReason && <div className="mt-1">Důvod: {p.deletionReason}</div>}
          {p.can.delete && (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => open("restore")} disabled={busy}><RotateCcw size={15} /> Obnovit firmu</Button>
            </div>
          )}
        </div>
      )}
      {p.status === "suspended" && (
        <div className="rounded bg-warning-light px-3 py-2 text-sm text-warning-dark">Účet je pozastaven: zákazníci vidí data, ale nemohou nic měnit.</div>
      )}
      {error && !modal && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {p.can.impersonate && !locked && <ImpersonateButton companyId={p.companyId} />}
        {p.can.export && <Button variant="secondary" onClick={exportData} disabled={busy}><Download size={15} /> Export dat</Button>}
        {p.can.suspend && p.status === "active" && <Button variant="secondary" onClick={() => open("suspend")}><Pause size={15} /> Pozastavit</Button>}
        {p.can.suspend && p.status === "suspended" && <Button variant="secondary" onClick={unsuspend} disabled={busy}><Play size={15} /> Obnovit provoz</Button>}
        {p.can.delete && !locked && <Button variant="danger" onClick={() => open("delete")}><Trash2 size={15} /> Smazat firmu</Button>}
      </div>

      <ConfirmDialog
        open={modal === "restore"}
        onOpenChange={(o) => !o && setModal(null)}
        title="Obnovit firmu"
        description="Zruší se naplánované smazání a firma se vrátí do provozu. Zákazníci se budou moct znovu přihlásit."
        confirmLabel="Obnovit firmu"
        busy={busy}
        error={error}
        onConfirm={restore}
      />

      <Dialog open={modal === "suspend"} onOpenChange={(o) => !o && setModal(null)}>
        {modal === "suspend" && (
          <DialogContent title="Pozastavit účet" footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Zrušit</Button><Button onClick={suspend} disabled={busy || reason.trim().length < 3}>{busy ? "Ukládám…" : "Pozastavit"}</Button></div>}>
            <div className="space-y-4">
              <p className="text-sm text-muted">Firma zůstane čitelná, ale nic v ní nepůjde měnit. Data se nemažou.</p>
              <div>
                <label className={labelClass} htmlFor="susp-reason">Důvod (uloží se do auditu)</label>
                <input id="susp-reason" className={inputClass} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Poslat firmě e-mail</label>
              {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={modal === "delete"} onOpenChange={(o) => !o && setModal(null)}>
        {modal === "delete" && (
          <DialogContent
            title="Smazat firmu"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Zrušit</Button>
                <Button variant="danger" onClick={del} disabled={busy || reason.trim().length < 3 || typedName.trim() !== p.companyName || code.replace(/\s/g, "").length !== 6}>{busy ? "Plánuji…" : "Naplánovat smazání"}</Button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">
                Smazání proběhne <strong>za 30 dní</strong>. Do té doby se zákazníci nemohou přihlásit, firmě odejde e-mail s exportem dat a v ochranné lhůtě jde firmu obnovit. Potom se smažou všichni uživatelé a firemní data; zůstanou faktury a audit.
              </div>
              <div>
                <label className={labelClass} htmlFor="del-reason">Důvod (uloží se do auditu)</label>
                <input id="del-reason" className={inputClass} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="např. žádost zákazníka o zrušení účtu" />
              </div>
              <div>
                <label className={labelClass} htmlFor="del-name">Pro potvrzení opište název firmy: <strong className="text-ink">{p.companyName}</strong></label>
                <input id="del-name" className={inputClass} value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="off" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Poslat firmě e-mail s oznámením a exportem dat</label>
              <div className="rounded border border-line bg-paper/50 p-3">
                <label className={labelClass} htmlFor="del-code">Kód TOTP z vaší aplikace</label>
                <input id="del-code" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className={`${inputClass} font-mono tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
