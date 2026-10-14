"use client";

import { useEffect, useState } from "react";
import { Link2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/use-features";
import { fetchDepartments } from "@/lib/data";
import { AdminEmployeeRow, fetchCompany, fetchCompanyEmployees, importEmployees } from "@/lib/admin-data";
import { DbDepartment, Role } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";
import { showToast } from "@/lib/toast";

const roleLabel: Record<Role, string> = { employee: "Zaměstnanec", manager: "Manažer", admin: "Admin" };
type StaffRoleChoice = "none" | "hr" | "accountant";
const staffRoleLabel: Record<StaffRoleChoice, string> = { none: "Žádná", hr: "HR", accountant: "Účetní" };

/** Targeted invite for one specific email — role/department/manager set up front, unlike
 * the generic company-wide link, which anyone who gets forwarded it can use to join. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "jana.novakova+test@firma.cz" -> "Jana Novakova" — used when several addresses are pasted at once.
 * Everything from "+" on is a mail-provider alias/tag (Gmail apod.), not part of the name, so it's dropped first. */
function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split("+")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function InviteUserModal({ onInvited, onCopyLink }: { onInvited?: () => void; onCopyLink?: () => void }) {
  const { profile } = useAuth();
  const features = useFeatures();
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [defaultVacation, setDefaultVacation] = useState(20);
  const [defaultSick, setDefaultSick] = useState(5);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [staffRole, setStaffRole] = useState<StaffRoleChoice>("none");
  // Externí HR/účetní (dodavatel, ne zaměstnanec firmy) nemá oddělení ani nadřízeného a nečerpá dovolenou.
  // Výchozí hodnota podle doplňkové role (účetní bývá externí, HR bývá interní), ale admin ji může přepnout.
  // Externí je vždy jen Zaměstnanec — dodavatel nemůže řídit vaše lidi (vynuceno i v DB).
  const [isExternal, setIsExternal] = useState(false);
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (staffRole === "accountant") setIsExternal(true);
    else if (staffRole === "hr") setIsExternal(false);
  }, [staffRole]);

  // Externí nemá oddělení ani nadřízeného — obě pole se vyčistí, ať se omylem nepošlou se starou hodnotou.
  useEffect(() => {
    if (isExternal) {
      setDepartmentId("none");
      setManagerId("none");
    }
  }, [isExternal]);

  useEffect(() => {
    if (!open || !profile) return;
    Promise.all([fetchDepartments(profile.company_id), fetchCompanyEmployees(profile.company_id), fetchCompany(profile.company_id)]).then(
      ([deps, emps, company]) => {
        setDepartments(deps);
        setEmployees(emps);
        setDefaultVacation(company.default_vacation_days);
        setDefaultSick(company.default_sick_days);
      }
    );
  }, [open, profile]);

  function reset() {
    setEmail("");
    setName("");
    setRole("employee");
    setStaffRole("none");
    setIsExternal(false);
    setDepartmentId("none");
    setManagerId("none");
    setError(null);
  }

  const emails = Array.from(new Set(email.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  const canSubmit = emails.length > 0 && invalid.length === 0;

  async function handleSubmit() {
    if (!profile || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const dept = departments.find((d) => d.id === departmentId);
      await importEmployees(
        profile.company_id,
        emails.map((em) => ({
          email: em,
          name: (emails.length === 1 && name.trim()) || nameFromEmail(em),
          department_name: dept?.name ?? null,
          manager_id: managerId === "none" ? null : managerId,
          manager_invite_email: null,
          vacation_total: defaultVacation,
          vacation_opening_used: 0,
          sick_total: defaultSick,
          sick_opening_used: 0,
          role,
          staff_role: staffRole === "none" ? null : staffRole,
          is_external: staffRole !== "none" ? isExternal : false,
        }))
      );
      const res = await fetch("/api/invite/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (res && res.sent > 0 && res.failed === 0) showToast(res.sent === 1 ? "Pozvánka odeslána e-mailem." : `Pozvánky odeslány e-mailem (${res.sent}).`);
      else showToast("Pozvánka je založená, ale e-mail se nepodařilo odeslat. Pošlete člověku registrační odkaz ručně.", "error");
      setOpen(false);
      reset();
      onInvited?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="primary">
          <UserPlus size={16} /> Pozvat uživatele
        </Button>
      </DialogTrigger>
      <DialogContent title="Pozvat uživatele">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Pozvánka je vázaná na e-mail — použít ji může jen ten, kdo se zaregistruje se stejnou adresou. Role, oddělení a nadřízený se nastaví všem pozvaným stejně — u jednotlivých lidí to kdykoli změníte později v Zaměstnancích.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mailové adresy</label>
            <textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              rows={3}
              placeholder="jana@firma.cz, petr@firma.cz"
              aria-label="E-mailové adresy"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            {invalid.length > 0 ? (
              <p className="mt-1 text-xs text-danger">Neplatná adresa: {invalid.join(", ")}</p>
            ) : (
              <p className="mt-1 text-xs text-muted">Můžete vložit víc adres najednou — oddělte je čárkou, mezerou nebo novým řádkem.{emails.length > 1 && ` Pozvete ${emails.length} lidí.`}</p>
            )}
          </div>

          {emails.length === 1 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Jméno (volitelné)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={nameFromEmail(emails[0])}
                aria-label="Jméno"
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isExternal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabel) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabel[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isExternal && <p className="mt-1 text-xs text-muted">Externí dodavatel je vždy Zaměstnanec.</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Doplňková role</label>
              <Select value={staffRole} onValueChange={(v) => setStaffRole(v as StaffRoleChoice)} disabled={profile?.role !== "admin"}>
                <SelectTrigger aria-label="Doplňková role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{staffRoleLabel.none}</SelectItem>
                  <SelectItem value="hr">{staffRoleLabel.hr}</SelectItem>
                  <SelectItem value="accountant" disabled={!features.has("accountant")}>
                    {staffRoleLabel.accountant}{features.has("accountant") ? "" : " (doplněk Účetní)"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted">Přidává práva navrch k roli vlevo (jde kombinovat, např. manažer, co je zároveň HR).</p>
            </div>
          </div>

          {staffRole !== "none" && (
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded border border-line px-3 py-2 text-sm">
              <span>
                Externí
                <span className="block text-xs font-normal text-muted">Dodavatel, ne zaměstnanec firmy — bez oddělení, nadřízeného a nároku na dovolenou v této firmě. Vždy jen Zaměstnanec.</span>
              </span>
              <Switch
                checked={isExternal}
                onCheckedChange={(v) => {
                  setIsExternal(v);
                  if (v) setRole("employee");
                }}
              />
            </label>
          )}

          {!isExternal && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Oddělení</label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
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
          )}

          {!isExternal && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nadřízený (volitelné)</label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez nadřízeného</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {onCopyLink && (
              <Button variant="secondary" onClick={onCopyLink}>
                <Link2 size={14} /> Kopírovat registrační odkaz
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Zrušit
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                {submitting ? "Odesílám…" : emails.length > 1 ? `Pozvat (${emails.length})` : "Odeslat pozvánku"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
