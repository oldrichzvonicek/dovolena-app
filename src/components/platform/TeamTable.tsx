"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { platformFetch } from "./api";
import { formatDateTime } from "./format";
import { Pill, inputClass, labelClass, tableClass, tdClass, thClass } from "./ui";

export interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  last_login_at: string | null;
}

const ROLES: { key: string; label: string; hint: string }[] = [
  { key: "super_admin", label: "Super-admin", hint: "vše včetně cen, bezpečnosti a týmu" },
  { key: "support", label: "Podpora", hint: "čte firmy, poznámky, audit; nemění tarify" },
  { key: "billing", label: "Fakturace", hint: "faktury a platby, jen fakturační údaje firem" },
];

export function TeamTable({ members, selfId }: { members: TeamMember[]; selfId: string }) {
  const [editing, setEditing] = useState<TeamMember | null>(null);
  return (
    <>
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Admin</th>
              <th className={thClass}>Role</th>
              <th className={thClass}>Stav</th>
              <th className={thClass}>Poslední přihlášení</th>
              <th className={thClass}><span className="sr-only">Akce</span></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td className={tdClass}>
                  <div className="font-medium">{m.name || m.email}{m.user_id === selfId && <span className="ml-2 text-caption text-muted">(vy)</span>}</div>
                  <div className="text-caption text-muted">{m.email}</div>
                </td>
                <td className={tdClass}>{ROLES.find((r) => r.key === m.role)?.label ?? m.role}</td>
                <td className={tdClass}>{m.active ? <Pill className="bg-teal-light text-teal-dark">Aktivní</Pill> : <Pill className="bg-rust-light text-rust-dark">Vypnutý</Pill>}</td>
                <td className={`${tdClass} whitespace-nowrap text-muted`}>{formatDateTime(m.last_login_at)}</td>
                <td className={`${tdClass} text-right`}>
                  {m.user_id !== selfId && <Button variant="secondary" className="px-3 py-1.5" onClick={() => setEditing(m)}>Upravit</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <EditDialog member={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/** Změna role nebo aktivity: nejdřív nový kód TOTP (step-up, platí 5 minut jen pro tuto akci), potom vlastní změna. */
function EditDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.active);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const action = `team.update:${member.user_id}`;
      const { token } = await platformFetch<{ token: string }>("/auth/step-up", { json: { action, code } });
      await platformFetch(`/team/${member.user_id}`, { method: "PATCH", json: { role, active }, headers: { "X-Step-Up-Token": token } });
      onClose();
      showToast(`Admin ${member.name || member.email} byl upraven.`);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  const unchanged = role === member.role && active === member.active;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={`Upravit: ${member.name || member.email}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Zrušit</Button>
            <Button onClick={save} disabled={busy || unchanged || code.replace(/\s/g, "").length !== 6}>{busy ? "Ukládám…" : "Potvrdit a uložit"}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="team-role">Role</label>
            <select id="team-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label} – {r.hint}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Účet je aktivní (vypnutý admin je okamžitě odhlášen)
          </label>
          <div className="rounded border border-line bg-paper/50 p-3">
            <label className={labelClass} htmlFor="team-code">Kód TOTP z vaší aplikace (citlivá akce)</label>
            <input id="team-code" inputMode="numeric" maxLength={7} autoComplete="one-time-code" className={`${inputClass} font-mono tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          {error && <p role="alert" className="rounded bg-danger-light px-3 py-2 text-sm text-danger-dark">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
