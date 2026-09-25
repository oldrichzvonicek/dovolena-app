"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Pencil, Search, Trash2, Upload, UserCheck, UserX, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { InviteBox } from "@/components/shared/InviteBox";
import { InviteUserModal } from "@/components/admin/InviteUserModal";
import { EditEmployeeModal } from "@/components/admin/EditEmployeeModal";
import { ImportEmployeesPanel } from "@/components/admin/ImportEmployeesPanel";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { fetchDepartments, fetchLeaveTypes } from "@/lib/data";
import {
  AdminEmployeeRow,
  CompanyInviteRow,
  EntitlementMap,
  deleteEmployee,
  deleteInvite,
  setEmployeeActive,
  fetchCompanyEmployees,
  fetchCompanyEntitlements,
  fetchCompanyInvites,
  upsertEntitlement,
} from "@/lib/admin-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { DbDepartment, DbLeaveType, Role } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/utils";

const roleLabel: Record<Role, string> = {
  employee: "Zaměstnanec",
  manager: "Manažer",
  admin: "Admin",
};

type Row =
  | { status: "active"; id: string; name: string; email: string | null; role: Role; department_id: string | null; employee: AdminEmployeeRow }
  | { status: "pending"; id: string; name: string; email: string | null; role: Role; department_id: string | null; invite: CompanyInviteRow };

export function UsersPanel() {
  const { profile } = useAuth();
  const year = new Date().getFullYear();

  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [invites, setInvites] = useState<CompanyInviteRow[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementMap>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingEmployee, setEditingEmployee] = useState<AdminEmployeeRow | null>(null);
  const [showGenericLink, setShowGenericLink] = useState(false);
  const [bulkVacation, setBulkVacation] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    if (!profile) return;
    const [emp, inv, dep, lt, ent] = await Promise.all([
      fetchCompanyEmployees(profile.company_id),
      fetchCompanyInvites(profile.company_id),
      fetchDepartments(profile.company_id),
      fetchLeaveTypes(profile.company_id),
      fetchCompanyEntitlements(profile.company_id, year),
    ]);
    setEmployees(emp);
    setInvites(inv);
    setDepartments(dep);
    setLeaveTypes(lt);
    setEntitlements(ent);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const vacationType = leaveTypes.find((t) => t.counts_against === "vacation");
  const sickType = leaveTypes.find((t) => t.counts_against === "sick");

  const rows: Row[] = useMemo(() => {
    const activeRows: Row[] = employees
      .filter((e) => showInactive || e.active !== false)
      .map((e) => ({
      status: "active",
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role,
      department_id: e.department_id,
      employee: e,
    }));
    const pendingRows: Row[] = invites.map((inv) => ({
      status: "pending",
      id: inv.id,
      name: inv.name,
      email: inv.email,
      role: inv.role,
      department_id: inv.department_id,
      invite: inv,
    }));
    return [...activeRows, ...pendingRows].sort((a, b) => a.name.localeCompare(b.name, "cs"));
  }, [employees, invites, showInactive]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (departmentFilter !== "all" && r.department_id !== departmentFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, departmentFilter, roleFilter]);

  const selectableIds = useMemo(() => filteredRows.filter((r) => r.status === "active" && r.employee.active !== false).map((r) => r.id), [filteredRows]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === selectableIds.length ? new Set() : new Set(selectableIds)));
  }

  async function handleBulkVacation() {
    if (!vacationType || selected.size === 0) return;
    const totalDays = Number(bulkVacation);
    if (Number.isNaN(totalDays) || totalDays < 0) return;
    setBulkApplying(true);
    try {
      await Promise.all([...selected].map((id) => upsertEntitlement(id, vacationType.id, year, totalDays)));
      setSelected(new Set());
      setBulkVacation("");
      load();
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleCancelInvite(id: string) {
    if (!(await confirmDialog("Zrušit tuto pozvánku?", { confirmLabel: "Zrušit pozvánku", danger: true }))) return;
    await deleteInvite(id);
    load();
  }

  async function handleToggleActive(row: Extract<Row, { status: "active" }>, active: boolean) {
    const msg = active
      ? `Znovu aktivovat uživatele ${row.name}?`
      : `Deaktivovat uživatele ${row.name}? Ztratí přístup do aplikace a zmizí z kalendáře a týmových přehledů, historie absencí zůstane.`;
    if (!(await confirmDialog(msg, { confirmLabel: active ? "Aktivovat" : "Deaktivovat", danger: !active }))) return;
    setDeletingId(row.id);
    try {
      await setEmployeeActive(row.id, active);
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeleteEmployee(row: Extract<Row, { status: "active" }>) {
    if (!(await confirmDialog(`Opravdu TRVALE smazat uživatele ${row.name} včetně celé historie absencí? Nejde vzít zpět. (Odcházející lidi raději jen deaktivujte.)`, { confirmLabel: "Trvale smazat", danger: true }))) return;
    setDeletingId(row.id);
    try {
      await deleteEmployee(row.id);
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="card p-8 text-center text-sm text-muted">Načítám…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <InviteUserModal onInvited={load} />

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">
              <Upload size={16} /> Import / Export
            </Button>
          </DialogTrigger>
          <DialogContent title="Hromadný import zaměstnanců" className="max-w-3xl">
            <ImportEmployeesPanel />
          </DialogContent>
        </Dialog>

        <button
          onClick={() => setShowGenericLink((v) => !v)}
          className="flex items-center gap-1.5 rounded px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink"
        >
          <Link2 size={14} /> Obecný pozvánkový odkaz
        </button>
      </div>

      {showGenericLink && <InviteBox />}

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-3.5 w-3.5" />
        Zobrazit deaktivované
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat jméno nebo e-mail…" aria-label="Hledat jméno nebo e-mail"
            className="w-56 rounded border border-line py-2 pl-8 pr-3 text-sm"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechna oddělení</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny role</SelectItem>
            {(Object.keys(roleLabel) as Role[]).map((r) => (
              <SelectItem key={r} value={r}>
                {roleLabel[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-teal/30 bg-teal-light p-3">
          <span className="text-sm font-medium text-teal-dark">Vybráno {selected.size}</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={bulkVacation}
            onChange={(e) => setBulkVacation(e.target.value)}
            placeholder="Dní dovolené" aria-label="Dní dovolené"
            disabled={!vacationType}
            className="w-32 rounded border border-line px-3 py-1.5 text-sm disabled:bg-paper"
          />
          <Button variant="primary" onClick={handleBulkVacation} disabled={bulkApplying || !bulkVacation || !vacationType}>
            {bulkApplying ? "Ukládám…" : "Nastavit dovolenou"}
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto flex items-center gap-1 text-sm text-teal-dark hover:underline">
            <X size={14} /> Zrušit výběr
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-line p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-light text-violet-dark">
              <Users size={15} />
            </div>
            <h2 className="font-display text-h2">Zaměstnanci ({filteredRows.length})</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                <th className="w-10 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={selectableIds.length > 0 && selected.size === selectableIds.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-line accent-teal"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Jméno</th>
                <th className="px-3 py-3 font-medium">E-mail</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Oddělení</th>
                <th className="px-3 py-3 font-medium">Stav</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const dept = departments.find((d) => d.id === r.department_id);
                return (
                  <tr key={`${r.status}-${r.id}`} className="group border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-5 py-3">
                      {r.status === "active" && r.employee.active !== false && (
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          className="h-4 w-4 rounded border-line accent-teal"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-muted">{r.email ?? "—"}</td>
                    <td className="px-3 py-3 text-muted">{roleLabel[r.role]}</td>
                    <td className="px-3 py-3 text-muted">{dept?.name ?? "—"}</td>
                    <td className="px-3 py-3">
                      {r.status === "active" && r.employee.active === false ? (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-paper px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Deaktivován
                        </span>
                      ) : r.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-teal-light px-2 py-0.5 text-xs font-medium text-teal-dark">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Aktivní
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning-light px-2 py-0.5 text-xs font-medium text-warning-dark">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Čeká na pozvánku
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {r.status === "active" ? (
                        <div className="flex items-center gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            onClick={() => setEditingEmployee(r.employee)}
                            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
                          >
                            <Pencil size={12} /> Upravit
                          </button>
                          {r.id !== profile?.id && r.employee.active !== false && (
                            <button
                              onClick={() => handleToggleActive(r, false)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-warning/50 hover:bg-warning-light hover:text-warning-dark disabled:opacity-50"
                            >
                              <UserX size={12} /> Deaktivovat
                            </button>
                          )}
                          {r.id !== profile?.id && r.employee.active === false && (
                            <button
                              onClick={() => handleToggleActive(r, true)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark disabled:opacity-50"
                            >
                              <UserCheck size={12} /> Aktivovat
                            </button>
                          )}
                          {r.id !== profile?.id && r.employee.active === false && (
                            <button
                              onClick={() => handleDeleteEmployee(r)}
                              disabled={deletingId === r.id}
                              className="rounded border border-line p-1.5 text-muted hover:border-danger/40 hover:bg-danger-light hover:text-danger disabled:opacity-50"
                              aria-label={`Trvale smazat ${r.name}`}
                              title="Trvale smazat včetně historie"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCancelInvite(r.id)}
                          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted opacity-0 hover:border-danger/40 hover:bg-danger-light hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          <X size={12} /> Zrušit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted">
                    Nikdo neodpovídá zvolenému filtru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          employees={employees}
          departments={departments}
          vacationType={vacationType}
          sickType={sickType}
          homeOfficeType={leaveTypes.find((t) => t.key === "home_office")}
          entitlements={entitlements}
          year={year}
          onClose={() => setEditingEmployee(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
