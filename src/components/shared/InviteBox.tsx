"use client";

import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchDepartments } from "@/lib/data";
import { fetchCompany, importEmployees } from "@/lib/admin-data";
import { DbDepartment, Role } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useJoinLink } from "@/lib/use-join-link";
import { showToast } from "@/lib/toast";

export function InviteBox() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const { url, info, loading } = useJoinLink(!!profile);

  if (!profile) return null;
  const link = url ?? (loading ? "Načítám…" : "Odkaz je vypnutý");

  async function copyInvite() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — nothing more we can do here
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <UserPlus size={16} />
        </div>
        <h2 className="font-display text-h2">Pozvat kolegu do týmu</h2>
      </div>
      <p className="mt-2 text-sm text-muted">
        Pošlete tento odkaz novému zaměstnanci — po registraci se rovnou přiřadí k vaší firmě jako zaměstnanec. Roli,
        oddělení a nadřízeného pak nastavíte v Nastavení firmy.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full max-w-md rounded border border-line bg-paper px-3 py-2 text-sm text-muted"
        />
        <button
          onClick={copyInvite}
          disabled={!url}
          className="flex shrink-0 items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper"
        >
          {copied ? <Check size={15} className="text-teal-dark" /> : <Copy size={15} />}
          {copied ? "Zkopírováno" : "Kopírovat"}
        </button>
      </div>
    </div>
  );
}

/** Compact variant: dialog with a copyable link, or (admins) a targeted invite with role and department preset. */
export function InviteColleagueButton() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"link" | "email">("link");
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [departmentId, setDepartmentId] = useState("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { url, info, loading: linkLoading } = useJoinLink(open && !!profile);

  useEffect(() => {
    if (open && profile) fetchDepartments(profile.company_id).then(setDepartments);
  }, [open, profile]);

  if (!profile) return null;
  const link = url ?? (linkLoading ? "Načítám…" : "Odkaz je vypnutý");
  const isAdmin = profile.role === "admin";

  async function copyInvite() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied
    }
  }

  /** Založí pozvánku (role + oddělení vázané na e-mail) a buď ji pošle e-mailem, nebo zkopíruje odkaz k registraci. */
  async function createInvite(mode: "send" | "copy") {
    if (!profile || !email.trim() || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const company = await fetchCompany(profile.company_id);
      const dept = departments.find((d) => d.id === departmentId);
      await importEmployees(profile.company_id, [
        {
          email: email.trim(),
          name: name.trim(),
          department_name: dept?.name ?? null,
          manager_id: null,
          manager_invite_email: null,
          vacation_total: company.default_vacation_days,
          vacation_opening_used: 0,
          sick_total: company.default_sick_days,
          sick_opening_used: 0,
          role,
        },
      ]);
      if (mode === "copy") {
        const target = url ?? `${window.location.origin}/login`;
        try {
          await navigator.clipboard.writeText(target);
          showToast("Pozvánka je založená a odkaz zkopírovaný. Pošlete ho nováčkovi, ať se zaregistruje stejným e-mailem.");
        } catch {
          showToast("Pozvánka je založená. Odkaz zkopírujte ručně ze záložky „Kopírovat odkaz“.", "info");
        }
      } else {
        const res = await fetch("/api/invite/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails: [email.trim().toLowerCase()] }) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (res && res.sent > 0) showToast("Pozvánka odeslána e-mailem.");
        else showToast("Pozvánka je založená, ale e-mail se nepodařilo odeslat. Použijte „Vytvořit a kopírovat odkaz“ a pošlete ho ručně.", "error");
      }
      setEmail("");
      setName("");
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const tabBtn = (key: "link" | "email", label: string) => (
    <button
      onClick={() => setTab(key)}
      className={cn("rounded-full border px-3 py-1 text-xs font-medium", tab === key ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-paper")}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <UserPlus size={16} /> Pozvat kolegu
        </Button>
      </DialogTrigger>
      <DialogContent title="Pozvat kolegu do týmu">
        <div className="mb-3 flex gap-1.5">
          {tabBtn("link", "Kopírovat odkaz")}
          {tabBtn("email", "Odeslat na e-mail")}
        </div>

        {tab === "link" ? (
          <>
            <p className="text-sm text-muted">
              Pošlete tento odkaz novému zaměstnanci — po registraci se přiřadí k vaší firmě jako zaměstnanec{info?.require_approval ? " (nejdřív ho ale musí schválit admin)" : ""}. Roli a oddělení pak nastavíte v Můj tým.
            </p>
            {info && !info.enabled && <p className="mt-2 text-sm text-warning-dark">Registrační odkaz je vypnutý. Admin ho zapne v Nastavení firmy → Uživatelé.</p>}
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Pozvánkový odkaz" className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-muted" />
              <button onClick={copyInvite} disabled={!url} className="flex shrink-0 items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper disabled:opacity-50">
                {copied ? <Check size={15} className="text-teal-dark" /> : <Copy size={15} />}
                {copied ? "Zkopírováno" : "Kopírovat"}
              </button>
            </div>
          </>
        ) : !isAdmin ? (
          <p className="text-sm text-muted">Pozvánku s přednastavenou rolí a oddělením může vytvořit jen admin firmy. Použijte záložku „Kopírovat odkaz“.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Vytvoří pozvánku s přednastavenou rolí a oddělením. Nováček dostane e-mail s odkazem, nebo mu odkaz pošlete sami. Po registraci stejným e-mailem se rovnou zařadí.
            </p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jméno a příjmení" aria-label="Jméno a příjmení" className="w-full rounded border border-line px-3 py-2 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail nováčka" aria-label="E-mail nováčka" className="w-full rounded border border-line px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Zaměstnanec</SelectItem>
                  <SelectItem value="manager">Manažer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger aria-label="Oddělení">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez oddělení</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-danger-dark">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => createInvite("copy")} disabled={busy || !email.trim() || !name.trim()}>
                <Copy size={15} /> Vytvořit a kopírovat odkaz
              </Button>
              <Button onClick={() => createInvite("send")} disabled={busy || !email.trim() || !name.trim()}>
                {busy ? "Vytvářím…" : "Odeslat pozvánku e-mailem"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
