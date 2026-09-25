"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchDepartments } from "@/lib/data";
import { AdminEmployeeRow, fetchCompany, fetchCompanyEmployees, importEmployees } from "@/lib/admin-data";
import { DbDepartment, Role } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";

const roleLabel: Record<Role, string> = { employee: "Zaměstnanec", manager: "Manažer", admin: "Admin" };

/** Targeted invite for one specific email — role/department/manager set up front, unlike
 * the generic company-wide link, which anyone who gets forwarded it can use to join. */
export function InviteUserModal({ onInvited }: { onInvited?: () => void }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [defaultVacation, setDefaultVacation] = useState(20);
  const [defaultSick, setDefaultSick] = useState(5);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [managerId, setManagerId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setDepartmentId("none");
    setManagerId("none");
    setError(null);
  }

  async function handleSubmit() {
    if (!profile || !email.trim() || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const dept = departments.find((d) => d.id === departmentId);
      await importEmployees(profile.company_id, [
        {
          email: email.trim(),
          name: name.trim(),
          department_name: dept?.name ?? null,
          manager_id: managerId === "none" ? null : managerId,
          manager_invite_email: null,
          vacation_total: defaultVacation,
          vacation_opening_used: 0,
          sick_total: defaultSick,
          sick_opening_used: 0,
          role,
        },
      ]);
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
            Pozvánka je vázaná na tento e-mail — použít ji může jen ten, kdo se zaregistruje se stejnou adresou.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jana@firma.cz" aria-label="jana@firma.cz"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Jméno</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jana Nováková" aria-label="Jana Nováková"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
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
            </div>
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
          </div>

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

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !email.trim() || !name.trim()}>
              {submitting ? "Odesílám…" : "Odeslat pozvánku"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
