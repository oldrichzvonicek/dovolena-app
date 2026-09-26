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
import { showToast } from "@/lib/toast";
import { LoadingLines } from "@/components/ui/skeleton";
import { fetchDecisionScope } from "@/lib/approval-scope";

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
      zbývá {formatNumber(remaining)} z {formatNumber(total)} dní
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

    // Visibility scope: admins see the whole company; a manager sees the people they may decide for
    // (direct reports, their department as head/deputy, or as a standing substitute) — see fetchDecisionScope.
    const allEmployees = (employees as unknown as Emp[]) ?? [];
    const scope = await fetchDecisionScope(profile);
    const scopedEmployees = allEmployees.filter((e) => scope.canDecide(e));

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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visibleRows.forEach((r) => n.delete(r.id));
      else visibleRows.forEach((r) => n.add(r.id));
      return n;
    });

  /** Hromadná změna u všech zaškrtnutých (oddělení, nadřízený nebo zástup). Člověk nemůže být svým vlastním nadřízeným ani zástupem. */
  async function bulkApply(field: "department" | "manager" | "substitute", raw: string) {
    const value = raw === "none" ? null : raw;
    const ids = Array.from(selected).filter((id) => field === "department" || id !== value);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of ids) {
        if (field === "department") await handleDepartmentChange(id, value);
        else if (field === "manager") await handleManagerChange(id, value);
        else await handleSubstituteChange(id, value);
      }
      showToast(`Změna uložena u ${ids.length} ${ids.length === 1 ? "člověka" : "lidí"}.`);
      setSelected(new Set());
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Změnu se nepodařilo uložit.", "error");
    } finally {
      setBulkBusy(false);
    }
  }

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
      <Header title={isAdmin ? "Zaměstnanci" : "Můj tým"} subtitle={isAdmin ? "Přehled všech lidí ve firmě, jejich zůstatků a zařazení" : "Přehled členů týmu, jejich zůstatků a zařazení"} />
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

            {selected.size > 0 && (
              <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-teal/40 bg-teal-light px-4 py-2.5 text-sm shadow-sm" role="region" aria-label="Hromadné akce">
                <span className="mr-1 font-medium">Vybráno: {selected.size}</span>
                <Select value="" onValueChange={(v) => bulkApply("manager", v)} disabled={bulkBusy}>
                  <SelectTrigger className="w-48 bg-white py-1.5 text-xs" aria-label="Nastavit nadřízeného">
                    <SelectValue placeholder="Nastavit nadřízeného…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez nadřízeného</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value="" onValueChange={(v) => bulkApply("department", v)} disabled={bulkBusy}>
                  <SelectTrigger className="w-48 bg-white py-1.5 text-xs" aria-label="Přidělit do oddělení">
                    <SelectValue placeholder="Přidělit do oddělení…" />
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
                <Select value="" onValueChange={(v) => bulkApply("substitute", v)} disabled={bulkBusy}>
                  <SelectTrigger className="w-48 bg-white py-1.5 text-xs" aria-label="Nastavit zástup">
                    <SelectValue placeholder="Nastavit zástup…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez zástupu</SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted underline hover:text-ink">
                  Zrušit výběr
                </button>
              </div>
            )}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table-cards w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-muted">
                      <th className="w-10 px-3 py-3">
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Vybrat všechny zobrazené" className="h-3.5 w-3.5" />
                      </th>
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
                        <tr key={e.id} className={cn("border-b border-line last:border-0", selected.has(e.id) && "bg-teal-light/30")}>
                          <td className="px-3 py-3">
                            <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleOne(e.id)} aria-label={`Vybrat ${e.name}`} className="h-3.5 w-3.5" />
                          </td>
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
                        <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted">
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
