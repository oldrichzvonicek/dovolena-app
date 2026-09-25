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

export function InviteBox() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!profile) return null;
  const link = `${window.location.origin}/login?company=${profile.company_id}`;

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(link);
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

  useEffect(() => {
    if (open && profile) fetchDepartments(profile.company_id).then(setDepartments);
  }, [open, profile]);

  if (!profile) return null;
  const link = `${window.location.origin}/login?company=${profile.company_id}`;
  const isAdmin = profile.role === "admin";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied
    }
  }

  async function sendEmail() {
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
      const subject = encodeURIComponent("Pozvánka do Dodio");
      const body = encodeURIComponent(
        `Ahoj ${name.trim().split(" ")[0]},\n\nzaregistruj se prosím na tomto odkazu, stejným e-mailem, na který tě zvu: ${link}\n\nPo registraci budeš rovnou zařazen(a) do firmy.`
      );
      window.location.href = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
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
              Pošlete tento odkaz novému zaměstnanci — po registraci se rovnou přiřadí k vaší firmě jako zaměstnanec. Roli a oddělení pak nastavíte v Můj tým.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Pozvánkový odkaz" className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-muted" />
              <button onClick={copyInvite} className="flex shrink-0 items-center gap-1.5 rounded border border-line px-3 py-2 text-sm hover:bg-paper">
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
              Vytvoří pozvánku s přednastavenou rolí a oddělením a otevře e-mail s odkazem (aplikace zatím e-maily sama neodesílá). Nováček se po registraci stejným e-mailem rovnou zařadí.
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
            <div className="flex justify-end">
              <Button onClick={sendEmail} disabled={busy || !email.trim() || !name.trim()}>
                {busy ? "Vytvářím…" : "Vytvořit pozvánku a otevřít e-mail"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
