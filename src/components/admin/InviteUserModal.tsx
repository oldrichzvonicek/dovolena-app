"use client";

import { useEffect, useState } from "react";
import { Link2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchDepartments } from "@/lib/data";
import { AdminEmployeeRow, fetchCompany, fetchCompanyEmployees, importEmployees } from "@/lib/admin-data";
import { DbDepartment, Role } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";
import { showToast } from "@/lib/toast";

const roleLabel: Record<Role, string> = { employee: "Zaměstnanec", manager: "Manažer", admin: "Admin" };
// Jedna volba místo dvou samostatných selectů (Role + Doplňková role) — "je to účetní, ale taky zaměstnanec"
// působilo jako dvě si odporující odpovědi na stejnou otázku. HR/Účetní tu reálně skoro vždy znamená "běžný
// zaměstnanec s navíc touhle schopností", takže se to tak rovnou nastaví; vzácnou kombinaci (např. manažer,
// co je zároveň HR) jde po přijetí pozvánky doladit v Upravit (EditEmployeeModal).
type RoleChoice = Role | "hr" | "accountant";
const roleChoiceLabel: Record<RoleChoice, string> = { employee: "Zaměstnanec", manager: "Manažer", admin: "Admin", hr: "HR", accountant: "Účetní" };

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
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [defaultVacation, setDefaultVacation] = useState(20);
  const [defaultSick, setDefaultSick] = useState(5);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleChoice, setRoleChoice] = useState<RoleChoice>("employee");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Účetní bývá externí (ne ve firemní struktuře) — oddělení a nadřízený na něj nedávají smysl, takže se
  // při přepnutí na tuhle roli obě pole vyčistí, ať se omylem nepošlou se starou hodnotou z dřívějšího výběru.
  useEffect(() => {
    if (roleChoice === "accountant") {
      setDepartmentId("none");
      setManagerId("none");
    }
  }, [roleChoice]);

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
    setRoleChoice("employee");
    setDepartmentId("none");
    setManagerId("none");
    setError(null);
  }

  const emails = Array.from(new Set(email.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  const canSubmit = emails.length > 0 && invalid.length === 0;
  const role: Role = roleChoice === "hr" || roleChoice === "accountant" ? "employee" : roleChoice;
  const staffRole: "hr" | "accountant" | null = roleChoice === "hr" || roleChoice === "accountant" ? roleChoice : null;

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
          staff_role: staffRole,
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
            Pozvánka je vázaná na e-mail — použít ji může jen ten, kdo se zaregistruje se stejnou adresou. Role, oddělení a nadřízený se nastaví všem pozvaným.
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

          <div className={cn("grid gap-3", roleChoice === "accountant" ? "grid-cols-1" : "grid-cols-2")}>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={roleChoice} onValueChange={(v) => setRoleChoice(v as RoleChoice)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabel) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleChoiceLabel[r]}
                    </SelectItem>
                  ))}
                  {profile?.role === "admin" && (
                    <>
                      <SelectItem value="hr">{roleChoiceLabel.hr}</SelectItem>
                      <SelectItem value="accountant">{roleChoiceLabel.accountant}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {roleChoice === "hr" && <p className="mt-1 text-xs text-muted">Pro HR, co ve firmě nemá klasickou roli (vzácnější kombinaci, třeba manažera, co je zároveň HR, jde doladit po přijetí pozvánky v Upravit).</p>}
              {roleChoice === "accountant" && (
                <p className="mt-1 text-xs text-muted">Účetní bývá externí — proto bez oddělení a nadřízeného. Jen čte absence pro mzdy, neschvaluje a nezapadá do firemní struktury.</p>
              )}
            </div>
            {roleChoice !== "accountant" && (
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
          </div>

          {roleChoice !== "accountant" && (
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
