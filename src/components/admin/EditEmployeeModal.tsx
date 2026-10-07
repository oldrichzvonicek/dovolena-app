"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/use-features";
import { PlanTag } from "@/components/shared/FeatureGate";
import { InfoTip } from "@/components/ui/info-tip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AdminEmployeeRow,
  EntitlementMap,
  previewProratedVacation,
  updateEmployeeDepartment,
  updateEmployeeExternal,
  updateEmployeeHireDate,
  updateEmployeeHrData,
  updateEmployeeManager,
  updateEmployeeRole,
  updateEmployeeStaffRole,
  updateEmployeeSubstitute,
  upsertEntitlement,
} from "@/lib/admin-data";
import { DbDepartment, DbLeaveType, Role } from "@/lib/supabase/types";
import { errorMessage, formatNumber } from "@/lib/utils";

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
  const features = useFeatures();
  const [staffRole, setStaffRole] = useState<string>(employee.staff_role ?? "none");
  const [isExternal, setIsExternal] = useState(employee.is_external ?? false);
  const [departmentId, setDepartmentId] = useState(employee.department_id ?? "none");
  const [managerId, setManagerId] = useState(employee.manager_id ?? "none");
  const [substituteId, setSubstituteId] = useState(employee.substitute_id ?? "none");
  const [vacationDays, setVacationDays] = useState(String(vacationType ? entitlements[employee.id]?.[vacationType.id] ?? 0 : 0));
  const [homeOfficeDays, setHomeOfficeDays] = useState(homeOfficeType ? String(entitlements[employee.id]?.[homeOfficeType.id] ?? "") : "");
  const [sickDays, setSickDays] = useState(String(sickType ? entitlements[employee.id]?.[sickType.id] ?? 0 : 0));
  const [hireDate, setHireDate] = useState(employee.hire_date ?? "");
  const [terminationDate, setTerminationDate] = useState(employee.termination_date ?? "");
  const [personalNumber, setPersonalNumber] = useState(employee.personal_number ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recalcState, setRecalcState] = useState<"idle" | "loading" | "done">("idle");

  // Nárok se poměrně krátí podle data nástupu jen v okamžiku založení účtu — pozdější změna data sama o sobě
  // už uložený nárok nepřepočítá. Tohle spočítá, kolik by teď podle aktuálního data mělo být, a jen předvyplní
  // pole Dovolená / rok; admin číslo vidí a potvrdí ho běžným Uložit (nic se nezapíše samo od sebe).
  async function handleRecalc() {
    if (!vacationType) return;
    setRecalcState("loading");
    setError(null);
    try {
      const days = await previewProratedVacation(employee.id, year);
      if (days !== null) setVacationDays(String(days));
      setRecalcState("done");
      setTimeout(() => setRecalcState("idle"), 2500);
    } catch (e) {
      setError(errorMessage(e));
      setRecalcState("idle");
    }
  }

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all([
        role !== employee.role ? updateEmployeeRole(employee.id, role) : null,
        staffRole !== (employee.staff_role ?? "none") ? updateEmployeeStaffRole(employee.id, staffRole === "none" ? null : (staffRole as "hr" | "accountant")) : null,
        isExternal !== (employee.is_external ?? false) ? updateEmployeeExternal(employee.id, isExternal) : null,
        !isExternal && departmentId !== (employee.department_id ?? "none")
          ? updateEmployeeDepartment(employee.id, departmentId === "none" ? null : departmentId)
          : null,
        !isExternal && managerId !== (employee.manager_id ?? "none") ? updateEmployeeManager(employee.id, managerId === "none" ? null : managerId) : null,
        substituteId !== (employee.substitute_id ?? "none")
          ? updateEmployeeSubstitute(employee.id, substituteId === "none" ? null : substituteId)
          : null,
        hireDate !== (employee.hire_date ?? "") ? updateEmployeeHireDate(employee.id, hireDate || null) : null,
        terminationDate !== (employee.termination_date ?? "") || personalNumber.trim() !== (employee.personal_number ?? "")
          ? updateEmployeeHrData(employee.id, { termination_date: terminationDate || null, personal_number: personalNumber.trim() || null })
          : null,
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
      <DialogContent
        title={`Upravit — ${employee.name}`}
        className="max-w-2xl"
        footer={
          <div>
            {error && <p className="mb-2 text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Zrušit
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={submitting}>
                {submitting ? "Ukládám…" : "Uložit"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
          {employee.email && <p className="text-sm text-muted md:col-span-2">{employee.email}</p>}

          <div className="contents">
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
              {isExternal ? (
                <p className="rounded border border-line bg-paper px-3 py-2 text-sm text-muted">Externí — bez oddělení.</p>
              ) : (
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
              )}
            </div>
          </div>

          {!isExternal && (
          <div className="contents">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Nadřízený</label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez nadřízeného</SelectItem>
                  {employees
                    // Jen manažer nebo admin může reálně schvalovat — kdyby tu byl zaměstnanec, žádosti by
                    // stejně tiše schvaloval jen admin. Aktuálně nastavená hodnota zůstává vidět, i kdyby
                    // (ze starších dat) šlo o zaměstnance, ať admin ví, co je nastavené, a může to změnit.
                    .filter((e) => e.id !== employee.id && (e.role === "manager" || e.role === "admin" || e.id === managerId))
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                Zástup {!features.loading && !features.has("escalation") && <PlanTag feature="escalation" />}
              </label>
              <Select value={substituteId} onValueChange={setSubstituteId} disabled={!features.has("escalation")}>
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
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Doplňková role</label>
            <Select value={staffRole} onValueChange={setStaffRole} disabled={!isAdmin}>
              <SelectTrigger aria-label="Doplňková role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Žádná</SelectItem>
                <SelectItem value="hr">HR — správa lidí, vidí všechny absence</SelectItem>
                <SelectItem value="accountant" disabled={!features.has("accountant") && employee.staff_role !== "accountant"}>
                  Účetní — jen čtení absencí pro mzdy{features.has("accountant") ? "" : " (doplněk Účetní)"}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted">Přidává práva k základní roli (zaměstnanec/manažer/admin výše). Nastavuje jen admin. Role Účetní je od tarifu Starter v ceně, jinak jde o doplněk — role HR je zdarma na jakémkoli tarifu.</p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer select-none font-medium text-teal-dark">Co přesně role přidává?</summary>
              <div className="mt-2 overflow-hidden rounded border border-line">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-paper text-left text-muted">
                      <th className="px-2 py-1.5 font-medium">Co role přidává</th>
                      <th className="px-2 py-1.5 text-center font-medium">HR</th>
                      <th className="px-2 py-1.5 text-center font-medium">Účetní</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[
                      ["Spravuje lidi (oddělení, nadřízený, nároky, pozvánky)", true, false],
                      ["Aktivuje a deaktivuje uživatele", true, false],
                      ["Zadá absenci za kohokoli ve firmě", true, false],
                      ["Vidí všechny absence, včetně nemoci", true, true],
                      ["Analytika a Exporty (podklady pro mzdy)", true, true],
                      ["Schvaluje žádosti o absenci", false, false],
                    ].map(([label, hr, acc]) => (
                      <tr key={label as string}>
                        <td className="px-2 py-1.5">{label}</td>
                        <td className="px-2 py-1.5 text-center">{hr ? "✓" : "—"}</td>
                        <td className="px-2 py-1.5 text-center">{acc ? "✓" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {staffRole !== "none" && (
            <label className="flex cursor-pointer items-center justify-between gap-2 rounded border border-line px-3 py-2 text-sm">
              <span>
                Externí
                <span className="block text-xs font-normal text-muted">Dodavatel, ne zaměstnanec firmy — bez oddělení, nadřízeného a nároku na dovolenou v této firmě.</span>
              </span>
              <Switch checked={isExternal} onCheckedChange={setIsExternal} disabled={!isAdmin} />
            </label>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              Datum nástupu (volitelné)
              <InfoTip
                label="O přepočtu nároku podle data nástupu"
                text="Poměrná dovolená v roce nástupu (Nastavení → Typy absencí) a příplatek za odpracované roky se počítají automaticky jen při zakládání účtu. Když datum nástupu měníte dodatečně, tlačítkem Přepočítat si nechte pod tím do pole „Dovolená / rok“ doplnit odpovídající počet dní a uložte."
              />
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                aria-label="Datum nástupu"
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
              {vacationType && (
                <Button type="button" variant="secondary" className="shrink-0 px-3 py-2 text-sm" onClick={handleRecalc} disabled={!hireDate || recalcState === "loading"}>
                  {recalcState === "loading" ? "Počítám…" : recalcState === "done" ? "Přepočteno ✓" : "Přepočítat"}
                </Button>
              )}
            </div>
          </div>

          <div className="contents">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Datum ukončení pracovního poměru</label>
              <input
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                aria-label="Datum ukončení pracovního poměru"
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted">Podklad pro vyrovnání dovolené (Exporty → Vyrovnání při ukončení). Účet se tím sám nedeaktivuje.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Osobní číslo</label>
              <input
                value={personalNumber}
                onChange={(e) => setPersonalNumber(e.target.value)}
                aria-label="Osobní číslo"
                maxLength={30}
                className="w-full rounded border border-line px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted">Z mzdového systému; uvádí se v mzdových podkladech.</p>
            </div>
          </div>

          <div className="contents">
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

        </div>
      </DialogContent>
    </Dialog>
  );
}
