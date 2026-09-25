"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  AdminEmployeeRow,
  EntitlementMap,
  updateEmployeeDepartment,
  updateEmployeeHireDate,
  updateEmployeeManager,
  updateEmployeeRole,
  updateEmployeeStaffRole,
  updateEmployeeSubstitute,
  upsertEntitlement,
} from "@/lib/admin-data";
import { DbDepartment, DbLeaveType, Role } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";

const roleLabel: Record<Role, string> = { employee: "Zaměstnanec", manager: "Manažer", admin: "Admin" };

export function EditEmployeeModal({
  employee,
  employees,
  departments,
  vacationType,
  sickType,
  homeOfficeType,
  entitlements,
  year,
  onClose,
  onSaved,
}: {
  employee: AdminEmployeeRow;
  employees: AdminEmployeeRow[];
  departments: DbDepartment[];
  vacationType: DbLeaveType | undefined;
  sickType: DbLeaveType | undefined;
  homeOfficeType?: DbLeaveType;
  entitlements: EntitlementMap;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { profile: me } = useAuth();
  const isAdmin = me?.role === "admin";
  const [role, setRole] = useState<Role>(employee.role);
  const [staffRole, setStaffRole] = useState<string>(employee.staff_role ?? "none");
  const [departmentId, setDepartmentId] = useState(employee.department_id ?? "none");
  const [managerId, setManagerId] = useState(employee.manager_id ?? "none");
  const [substituteId, setSubstituteId] = useState(employee.substitute_id ?? "none");
  const [vacationDays, setVacationDays] = useState(String(vacationType ? entitlements[employee.id]?.[vacationType.id] ?? 0 : 0));
  const [homeOfficeDays, setHomeOfficeDays] = useState(homeOfficeType ? String(entitlements[employee.id]?.[homeOfficeType.id] ?? "") : "");
  const [sickDays, setSickDays] = useState(String(sickType ? entitlements[employee.id]?.[sickType.id] ?? 0 : 0));
  const [hireDate, setHireDate] = useState(employee.hire_date ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all([
        role !== employee.role ? updateEmployeeRole(employee.id, role) : null,
        staffRole !== (employee.staff_role ?? "none") ? updateEmployeeStaffRole(employee.id, staffRole === "none" ? null : (staffRole as "hr" | "accountant")) : null,
        departmentId !== (employee.department_id ?? "none")
          ? updateEmployeeDepartment(employee.id, departmentId === "none" ? null : departmentId)
          : null,
        managerId !== (employee.manager_id ?? "none") ? updateEmployeeManager(employee.id, managerId === "none" ? null : managerId) : null,
        substituteId !== (employee.substitute_id ?? "none")
          ? updateEmployeeSubstitute(employee.id, substituteId === "none" ? null : substituteId)
          : null,
        hireDate !== (employee.hire_date ?? "") ? updateEmployeeHireDate(employee.id, hireDate || null) : null,
        vacationType ? upsertEntitlement(employee.id, vacationType.id, year, Number(vacationDays) || 0) : null,
        sickType ? upsertEntitlement(employee.id, sickType.id, year, Number(sickDays) || 0) : null,
        homeOfficeType && homeOfficeDays !== "" ? upsertEntitlement(employee.id, homeOfficeType.id, year, Number(homeOfficeDays) || 0) : null,
      ]);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Upravit — ${employee.name}`}>
        <div className="space-y-4">
          {employee.email && <p className="text-sm text-muted">{employee.email}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={!isAdmin}>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nadřízený</label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez nadřízeného</SelectItem>
                  {employees
                    .filter((e) => e.id !== employee.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Zástup</label>
              <Select value={substituteId} onValueChange={setSubstituteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez zástupu</SelectItem>
                  {employees
                    .filter((e) => e.id !== employee.id)
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Doplňková role</label>
            <Select value={staffRole} onValueChange={setStaffRole} disabled={!isAdmin}>
              <SelectTrigger aria-label="Doplňková role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Žádná</SelectItem>
                <SelectItem value="hr">HR — správa lidí a nároků, vidí všechny absence</SelectItem>
                <SelectItem value="accountant">Účetní — jen čtení absencí pro mzdy</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted">Přidává práva k základní roli. Nastavuje jen admin.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Datum nástupu (volitelné)</label>
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              aria-label="Datum nástupu"
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted">Podle něj se počítá poměrná dovolená v roce nástupu a příplatek za odpracované roky (Nastavení → Typy absencí).</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Dovolená / rok</label>
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={!vacationType}
                value={vacationDays}
                onChange={(e) => setVacationDays(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm disabled:bg-paper"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Sick days / rok</label>
              <input
                type="number"
                min={0}
                step={0.5}
                disabled={!sickType}
                value={sickDays}
                onChange={(e) => setSickDays(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm disabled:bg-paper"
              />
            </div>
          </div>

          {homeOfficeType && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Home Office / rok (prázdné = firemní výchozí)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={homeOfficeDays}
                onChange={(e) => setHomeOfficeDays(e.target.value)}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={submitting}>
              {submitting ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
