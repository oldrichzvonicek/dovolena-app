"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Search, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { InviteColleagueButton } from "@/components/shared/InviteBox";
import { BookForEmployeeModal } from "@/components/manager/BookForEmployeeModal";
import { BurnoutWatch } from "@/components/manager/BurnoutWatch";
import { EmployeeDetailModal } from "@/components/manager/EmployeeDetailModal";
import { EditEmployeeModal } from "@/components/admin/EditEmployeeModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AdminEmployeeRow,
  EntitlementMap,
  fetchCompanyEmployees,
  fetchCompanyEntitlements,
  updateEmployeeDepartment,
  updateEmployeeManager,
  updateEmployeeSubstitute,
} from "@/lib/admin-data";
import { fetchLeaveTypes } from "@/lib/data";
import { loadBalances } from "@/lib/balances";
import { DbDepartment, DbLeaveType } from "@/lib/supabase/types";
import { cn, formatNumber } from "@/lib/utils";
import { LoadingLines } from "@/components/ui/skeleton";

interface Row {
  id: string;
  name: string;
  department_id: string | null;
  manager_id: string | null;
  substitute_id: string | null;
  vacationTotal: number;
  vacationUsed: number;
}

type EditableField = "department" | "manager" | "substitute";

/** Balance chip: red when overdrawn, amber when nearly out (0–2 days left). */
function BalanceChip({ total, used }: { total: number; used: number }) {
  const remaining = total - used;
  const overdrawn = remaining < 0;
  const low = !overdrawn && total > 0 && remaining <= 2;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-sm",
        overdrawn && "bg-danger-light font-medium text-danger-dark",
        low && "bg-warning-light font-medium text-warning-dark",
        !overdrawn && !low && "text-muted"
      )}
      title={overdrawn ? "Zaměstnanec je v minusu" : low ? "Dochází dovolená" : undefined}
    >
      {overdrawn && "🔴"}
      {formatNumber(remaining)} / {formatNumber(total)} dní
    </span>
  );
}

export default function TeamPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [editing, setEditing] = useState<{ id: string; field: EditableField } | null>(null);
  const [bookForId, setBookForId] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<Row | null>(null);
  const [adminEdit, setAdminEdit] = useState<{
    employees: AdminEmployeeRow[];
    leaveTypes: DbLeaveType[];
    entitlements: EntitlementMap;
  } | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const isAdmin = profile?.role === "admin";

  async function load() {
    if (!profile) return;
    const supabase = createClient();

    const [{ data: employees }, balances, { data: deps }] = await Promise.all([
      supabase.from("profiles").select("id, name, department_id, manager_id, substitute_id").eq("company_id", profile.company_id).eq("active", true),
      loadBalances(profile.company_id),
      supabase.from("departments").select("*").eq("company_id", profile.company_id),
    ]);

    type Emp = { id: string; name: string; department_id: string | null; manager_id: string | null; substitute_id: string | null };

    // Visibility scope: admins see the whole company. A department head sees
    // their department(s). A manager who doesn't head a department sees only
    // their direct reports — never the rest of the company.
    const allEmployees = (employees as unknown as Emp[]) ?? [];
    const headedDepartmentIds = new Set(
      (deps ?? []).filter((d) => d.head_profile_id === profile.id || d.deputy_head_profile_id === profile.id).map((d) => d.id)
    );
    const scopedEmployees =
      profile.role === "admin"
        ? allEmployees
        : headedDepartmentIds.size > 0
          ? allEmployees.filter((e) => e.department_id && headedDepartmentIds.has(e.department_id))
          : allEmployees.filter((e) => e.manager_id === profile.id);

    const built = scopedEmployees.map((e) => {
      const b = balances.get(e.id, "vacation");
      const vacationTotal = b.total;
      const vacationUsed = b.used + b.upcoming;
      return { id: e.id, name: e.name, department_id: e.department_id, manager_id: e.manager_id, substitute_id: e.substitute_id, vacationTotal, vacationUsed };
    });

    setRows(built);
    setPeople(allEmployees.map((e) => ({ id: e.id, name: e.name })));
    setDepartments(deps ?? []);
    setLoading(false);

    if (profile.role === "admin") {
      const [emp, lt, ent] = await Promise.all([
        fetchCompanyEmployees(profile.company_id),
        fetchLeaveTypes(profile.company_id),
        fetchCompanyEntitlements(profile.company_id, year),
      ]);
      setAdminEdit({ employees: emp, leaveTypes: lt, entitlements: ent });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name;
  const personName = (id: string | null) => people.find((p) => p.id === id)?.name;

  const usedDepartments = useMemo(
    () => departments.filter((d) => rows.some((r) => r.department_id === d.id)),
    [departments, rows]
  );

  const visibleRows = rows
    .filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => deptFilter === "all" || (deptFilter === "none" ? !r.department_id : r.department_id === deptFilter));

  async function handleDepartmentChange(id: string, departmentId: string | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, department_id: departmentId } : r)));
    await updateEmployeeDepartment(id, departmentId);
  }

  async function handleManagerChange(id: string, managerId: string | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, manager_id: managerId } : r)));
    await updateEmployeeManager(id, managerId);
  }

  async function handleSubstituteChange(id: string, substituteId: string | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, substitute_id: substituteId } : r)));
    await updateEmployeeSubstitute(id, substituteId);
  }

  /** Plain text by default; the dropdown only appears once you click the cell, so scrolling can't change anything by accident. */
  function EditableCell({
    row,
    field,
    label,
    value,
    noneLabel,
    options,
    onChange,
  }: {
    row: Row;
    field: EditableField;
    label: string | undefined;
    value: string | null;
    noneLabel: string;
    options: { id: string; name: string }[];
    onChange: (v: string | null) => void;
  }) {
    const isEditing = editing?.id === row.id && editing.field === field;
    if (isEditing) {
      return (
        <Select
          defaultOpen
          value={value ?? "none"}
          onValueChange={(v) => {
            onChange(v === "none" ? null : v);
            setEditing(null);
          }}
          onOpenChange={(o) => !o && setEditing(null)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{noneLabel}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <button
        onClick={() => setEditing({ id: row.id, field })}
        className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-paper"
        title="Kliknutím upravit"
      >
        <span className={cn(!label && "text-muted")}>{label ?? noneLabel}</span>
        <Pencil size={11} className="text-muted opacity-0 group-hover:opacity-100" />
      </button>
    );
  }

  const editingEmployee = adminEdit?.employees.find((e) => e.id === editingEmployeeId) ?? null;

  return (
    <div>
      <Header title="Můj tým" subtitle="Přehled členů týmu, jejich zůstatků a zařazení" />
      <div className="space-y-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isAdmin ? (
            <Link href="/admin/settings" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-teal-dark">
              <Settings size={14} /> Spravovat role, nároky a typy absencí v Nastavení firmy
            </Link>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <InviteColleagueButton />
            <BookForEmployeeModal onSaved={load} />
          </div>
        </div>

        {!loading && <BurnoutWatch employees={rows.map((r) => ({ id: r.id, name: r.name }))} />}

        {loading && <LoadingLines rows={4} />}
        {!loading && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Vyhledat zaměstnance…" aria-label="Vyhledat zaměstnance"
                  className="w-full rounded border border-line bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-48" aria-label="Filtr podle oddělení">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všechna oddělení</SelectItem>
                  {usedDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                  {rows.some((r) => !r.department_id) && <SelectItem value="none">Bez oddělení</SelectItem>}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted">
                {visibleRows.length} z {rows.length}
              </span>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-cards w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <th className="px-5 py-3 font-medium">Jméno</th>
                      <th className="px-3 py-3 font-medium">Oddělení</th>
                      <th className="px-3 py-3 font-medium">Nadřízený</th>
                      <th className="px-3 py-3 font-medium">Zástup</th>
                      <th className="px-3 py-3 font-medium">Dovolená</th>
                      <th className="px-3 py-3 font-medium">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((e) => {
                      const others = people.filter((p) => p.id !== e.id);
                      return (
                        <tr key={e.id} className="border-b border-line last:border-0">
                          <td className="cell-title px-5 py-3 font-medium">{e.name}</td>
                          <td className="px-3 py-2" data-label="Oddělení">
                            <EditableCell
                              row={e}
                              field="department"
                              label={deptName(e.department_id)}
                              value={e.department_id}
                              noneLabel="Bez oddělení"
                              options={departments.map((d) => ({ id: d.id, name: d.name }))}
                              onChange={(v) => handleDepartmentChange(e.id, v)}
                            />
                          </td>
                          <td className="px-3 py-2" data-label="Nadřízený">
                            <EditableCell
                              row={e}
                              field="manager"
                              label={personName(e.manager_id)}
                              value={e.manager_id}
                              noneLabel="Bez nadřízeného"
                              options={others}
                              onChange={(v) => handleManagerChange(e.id, v)}
                            />
                          </td>
                          <td className="px-3 py-2" data-label="Zástup">
                            <EditableCell
                              row={e}
                              field="substitute"
                              label={personName(e.substitute_id)}
                              value={e.substitute_id}
                              noneLabel="Bez zástupu"
                              options={others}
                              onChange={(v) => handleSubstituteChange(e.id, v)}
                            />
                          </td>
                          <td className="px-3 py-3" data-label="Dovolená">
                            <BalanceChip total={e.vacationTotal} used={e.vacationUsed} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              {e.id !== profile?.id && (
                                <button
                                  onClick={() => setBookForId(e.id)}
                                  className="rounded p-1.5 text-muted hover:bg-teal-light hover:text-teal-dark"
                                  title="Zadat absenci"
                                  aria-label="Zadat absenci"
                                >
                                  <Plus size={15} />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => setEditingEmployeeId(e.id)}
                                  className="rounded p-1.5 text-muted hover:bg-teal-light hover:text-teal-dark"
                                  title="Upravit profil / roli"
                                  aria-label="Upravit profil"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => setDetailFor(e)}
                                className="rounded p-1.5 text-muted hover:bg-teal-light hover:text-teal-dark"
                                title="Detail — historie absencí"
                                aria-label="Detail zaměstnance"
                              >
                                <Eye size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted">
                          Nikdo neodpovídá hledání.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {bookForId && (
        <BookForEmployeeModal
          hideTrigger
          open
          presetEmployeeId={bookForId}
          onOpenChange={(o) => !o && setBookForId(null)}
          onSaved={() => {
            setBookForId(null);
            load();
          }}
        />
      )}

      {detailFor && <EmployeeDetailModal employee={detailFor} onClose={() => setDetailFor(null)} />}

      {editingEmployee && adminEdit && (
        <EditEmployeeModal
          employee={editingEmployee}
          employees={adminEdit.employees}
          departments={departments}
          vacationType={adminEdit.leaveTypes.find((t) => t.counts_against === "vacation")}
          sickType={adminEdit.leaveTypes.find((t) => t.counts_against === "sick")}
          homeOfficeType={adminEdit.leaveTypes.find((t) => t.key === "home_office")}
          entitlements={adminEdit.entitlements}
          year={year}
          onClose={() => setEditingEmployeeId(null)}
          onSaved={() => {
            setEditingEmployeeId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
