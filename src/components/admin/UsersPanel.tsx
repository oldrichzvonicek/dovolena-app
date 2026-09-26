"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFeatures } from "@/lib/use-features";
import { Link2, Pencil, Search, Trash2, Upload, UserCheck, UserX, Users, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { InviteBox } from "@/components/shared/InviteBox";
import { InviteUserModal } from "@/components/admin/InviteUserModal";
import { EditEmployeeModal } from "@/components/admin/EditEmployeeModal";
import { ImportEmployeesPanel } from "@/components/admin/ImportEmployeesPanel";
import { ImportBalancesPanel } from "@/components/admin/ImportBalancesPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { JoinLinkCard } from "@/components/admin/JoinLinkCard";
import { DemoDataCard } from "@/components/admin/DemoDataCard";
import { copyJoinLink } from "@/lib/join-link";
import { fetchDepartments, fetchLeaveTypes } from "@/lib/data";
import {
  AdminEmployeeRow,
  CompanyInviteRow,
  EntitlementMap,
  approveJoiner,
  deleteEmployee,
  deleteInvite,
  updateEmployeeDepartment,
  updateEmployeeManager,
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
import { LoadingCard } from "@/components/ui/skeleton";

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
  const [importOpen, setImportOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [bulk, setBulk] = useState<null | "dept" | "manager" | "entitlement">(null);
  const [bulkTarget, setBulkTarget] = useState("");
  const [bulkSick, setBulkSick] = useState("");
  const [onlyNoApprover, setOnlyNoApprover] = useState(false);
  // HR správuje lidi, ale roli, deaktivaci, mazání a registrační odkaz nastavuje jen admin.
  const isAdmin = profile?.role === "admin";
  const features = useFeatures();
  const plan = features.plan;

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
      .filter((e) => showInactive || e.active !== false || e.join_pending)
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

  // Lidé, jejichž žádosti může schválit jen admin: bez nadřízeného a bez vedoucího / zástupce oddělení.
  const noApproverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of employees) {
      if (e.active === false || e.join_pending || e.role === "admin" || e.manager_id) continue;
      const d = departments.find((x) => x.id === e.department_id);
      if (!d || (!d.head_profile_id && !d.deputy_head_profile_id)) ids.add(e.id);
    }
    return ids;
  }, [employees, departments]);
  const pendingJoiners = useMemo(() => employees.filter((e) => e.join_pending && e.active === false), [employees]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (departmentFilter !== "all" && r.department_id !== departmentFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (onlyNoApprover && !(r.status === "active" && noApproverIds.has(r.id))) return false;
      if (q && !r.name.toLowerCase().includes(q) && !(r.email ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, departmentFilter, roleFilter, onlyNoApprover, noApproverIds]);

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
    const reports = employees.filter((e) => e.manager_id === row.id && e.active !== false).length;
    const headed = departments.filter((d) => d.head_profile_id === row.id || d.deputy_head_profile_id === row.id).length;
    const handover = [
      reports > 0 ? `${reports} podřízených přejde na jeho nadřízeného` : "",
      headed > 0 ? `vedoucí role v ${headed} odděleních přejdou na zástupce` : "",
    ]
      .filter(Boolean)
      .join(", ");
    const msg = active
      ? `Znovu aktivovat uživatele ${row.name}?`
      : `Deaktivovat uživatele ${row.name}? Ztratí přístup do aplikace a zmizí z kalendáře a týmových přehledů, historie absencí zůstane. Jeho čekající žádosti se zamítnou.${handover ? ` Dále: ${handover}.` : ""}`;
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

  async function copyGenericLink() {
    const r = await copyJoinLink();
    if (!r.ok) {
      alert(r.reason);
      return;
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  }

  async function handleApproveJoin(row: Extract<Row, { status: "active" }>) {
    setDeletingId(row.id);
    try {
      await approveJoiner(row.id);
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRejectJoin(row: Extract<Row, { status: "active" }>) {
    if (!(await confirmDialog(`Odmítnout registraci ${row.name}? Účet se smaže a dotyčný se do firmy nedostane.`, { confirmLabel: "Odmítnout a smazat", danger: true }))) return;
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

  async function applyBulk() {
    if (!bulk) return;
    setBulkApplying(true);
    try {
      const ids = [...selected];
      if (bulk === "dept") await Promise.all(ids.map((id) => updateEmployeeDepartment(id, bulkTarget === "none" ? null : bulkTarget)));
      if (bulk === "manager") await Promise.all(ids.map((id) => updateEmployeeManager(id, bulkTarget === "none" ? null : bulkTarget)));
      if (bulk === "entitlement") {
        await Promise.all(
          ids.flatMap((id) => [
            vacationType && bulkVacation !== "" ? upsertEntitlement(id, vacationType.id, year, Number(bulkVacation)) : null,
            sickType && bulkSick !== "" ? upsertEntitlement(id, sickType.id, year, Number(bulkSick)) : null,
          ])
        );
      }
      setBulk(null);
      setBulkTarget("");
      setBulkVacation("");
      setBulkSick("");
      setSelected(new Set());
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setBulkApplying(false);
    }
  }

  async function bulkDeactivate() {
    const ids = [...selected].filter((id) => id !== profile?.id);
    if (ids.length === 0) return;
    if (!(await confirmDialog(`Deaktivovat ${ids.length} vybraných uživatelů? Ztratí přístup, historie absencí zůstane.`, { confirmLabel: "Deaktivovat", danger: true }))) return;
    setBulkApplying(true);
    try {
      await Promise.all(ids.map((id) => setEmployeeActive(id, false)));
      setSelected(new Set());
      load();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setBulkApplying(false);
    }
  }

  if (loading) return <LoadingCard rows={8} />;

  // Limit uživatelů v tarifu: aktivní lidé bez ukázkových účtů a bez čekajících na schválení (server hlídá totéž).
  const activeCount = employees.filter((e) => e.active !== false && !e.join_pending && !e.is_demo).length;
  const userLimit = plan.employeeLimit;
  const atLimit = !features.loading && userLimit !== null && activeCount >= userLimit;

  return (
    <div className="space-y-6">
      {atLimit && (
        <div role="status" className="rounded border border-warning/40 bg-warning-light px-4 py-3 text-sm">
          <strong>
            Tarif {plan.name} umožňuje nejvýše {userLimit} uživatelů, ve firmě jich je {activeCount}.
          </strong>{" "}
          Nové lidi už nepůjde pozvat, importovat ani aktivovat.{" "}
          {isAdmin ? (
            <Link href="/admin/settings?sekce=billing" className="font-medium text-teal-dark underline underline-offset-2">
              Přejít na vyšší tarif
            </Link>
          ) : (
            "Požádejte správce firmy o vyšší tarif."
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <InviteUserModal onInvited={load} onCopyLink={copyGenericLink} />
        <Button variant="secondary" onClick={copyGenericLink}>
          <Link2 size={14} /> Kopírovat registrační odkaz
        </Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <Upload size={14} /> Import z mzdového systému
        </Button>
        {linkCopied && <span className="text-xs text-teal-dark">Odkaz zkopírován</span>}
      </div>

      {isAdmin && pendingJoiners.length > 0 && (
        <div className="rounded border border-warning/40 bg-warning-light px-4 py-3 text-sm text-ink" role="status">
          <strong>{pendingJoiners.length} {pendingJoiners.length === 1 ? "člověk čeká" : "lidé čekají"} na schválení registrace:</strong>{" "}
          {pendingJoiners.map((p) => p.name).join(", ")}. Schválíte je v seznamu níže.
        </div>
      )}

      {noApproverIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-white px-4 py-3 text-sm" role="status">
          <span>
            <strong>{noApproverIds.size} {noApproverIds.size === 1 ? "člověk nemá" : "lidí nemá"} nadřízeného ani vedoucího oddělení</strong> — jejich žádosti schválí jen admin.
          </span>
          <button onClick={() => setOnlyNoApprover((v) => !v)} className="text-teal-dark underline">
            {onlyNoApprover ? "Zobrazit všechny" : "Zobrazit je"}
          </button>
        </div>
      )}

      {isAdmin && <JoinLinkCard />}
      {isAdmin && <DemoDataCard />}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent title="Import z mzdového systému a tabulek" className="max-w-3xl">
          <Tabs defaultValue="employees">
            <TabsList className="mb-4">
              <TabsTrigger value="employees">Noví zaměstnanci</TabsTrigger>
              <TabsTrigger value="balances">Zůstatky dovolené</TabsTrigger>
            </TabsList>
            <TabsContent value="employees">
              <ImportEmployeesPanel />
            </TabsContent>
            <TabsContent value="balances">
              <ImportBalancesPanel />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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
          <SelectTrigger className="w-44" aria-label="Filtr podle oddělení">
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
          <SelectTrigger className="w-40" aria-label="Filtr podle role">
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
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-3.5 w-3.5" />
          Zobrazit deaktivované
        </label>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-teal/30 bg-teal-light p-3">
          <span className="text-sm font-medium text-teal-dark">Vybráno {selected.size}</span>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setBulk("dept")}>
            Změnit oddělení
          </Button>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setBulk("manager")}>
            Změnit nadřízeného
          </Button>
          <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setBulk("entitlement")}>
            Upravit nárok
          </Button>
          <Button variant="danger" className={isAdmin ? "px-3 py-1.5 text-sm" : "hidden"} onClick={bulkDeactivate} disabled={bulkApplying}>
            Deaktivovat vybrané
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto flex items-center gap-1 text-sm text-teal-dark hover:underline">
            <X size={14} /> Zrušit výběr
          </button>
        </div>
      )}

      <Dialog open={bulk !== null} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent title={bulk === "dept" ? "Změnit oddělení" : bulk === "manager" ? "Změnit nadřízeného" : "Upravit roční nárok"}>
          <div className="space-y-4">
            <p className="text-sm text-muted">Platí pro {selected.size} vybraných zaměstnanců.</p>
            {bulk === "dept" && (
              <Select value={bulkTarget} onValueChange={setBulkTarget}>
                <SelectTrigger aria-label="Nové oddělení">
                  <SelectValue placeholder="Vyberte oddělení" />
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
            {bulk === "manager" && (
              <Select value={bulkTarget} onValueChange={setBulkTarget}>
                <SelectTrigger aria-label="Nový nadřízený">
                  <SelectValue placeholder="Vyberte nadřízeného" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez nadřízeného</SelectItem>
                  {employees
                    .filter((e) => e.active !== false && !selected.has(e.id))
                    .map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
            {bulk === "entitlement" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Dovolená / rok (prázdné = beze změny)</label>
                  <input type="number" min={0} step={0.5} value={bulkVacation} onChange={(e) => setBulkVacation(e.target.value)} disabled={!vacationType} className="w-full rounded border border-line px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Sick days / rok (prázdné = beze změny)</label>
                  <input type="number" min={0} step={0.5} value={bulkSick} onChange={(e) => setBulkSick(e.target.value)} disabled={!sickType} className="w-full rounded border border-line px-3 py-2 text-sm" />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBulk(null)}>
                Zrušit
              </Button>
              <Button onClick={applyBulk} disabled={bulkApplying || (bulk !== "entitlement" && !bulkTarget) || (bulk === "entitlement" && !bulkVacation && !bulkSick)}>
                {bulkApplying ? "Ukládám…" : "Použít"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          <table className="table-cards w-full text-sm">
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
                    <td className="cell-title px-3 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-muted">{r.email ?? "—"}</td>
                    <td className="px-3 py-3 text-muted" data-label="Role">
                      {roleLabel[r.role]}
                      {r.status === "active" && r.employee.staff_role && (
                        <span className="ml-1.5 rounded-sm bg-violet-light px-1.5 py-0.5 text-[11px] font-medium text-violet-dark">{r.employee.staff_role === "hr" ? "HR" : "Účetní"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-muted" data-label="Oddělení">{dept?.name ?? "—"}</td>
                    <td className="px-3 py-3">
                      {r.status === "active" && r.employee.join_pending && r.employee.active === false ? (
                        <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning-light px-2 py-0.5 text-xs font-medium text-warning-dark">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" /> Čeká na schválení
                        </span>
                      ) : r.status === "active" && r.employee.active === false ? (
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
                      {r.status === "active" && r.employee.join_pending && r.employee.active === false ? (
                        isAdmin ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleApproveJoin(r)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-teal/40 bg-teal-light px-2 py-1 text-xs text-teal-dark hover:bg-teal-light/70 disabled:opacity-50"
                            >
                              <UserCheck size={12} /> Schválit
                            </button>
                            <button
                              onClick={() => handleRejectJoin(r)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-danger/40 hover:bg-danger-light hover:text-danger disabled:opacity-50"
                            >
                              <X size={12} /> Odmítnout
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Schvaluje admin</span>
                        )
                      ) : r.status === "active" ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingEmployee(r.employee)}
                            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
                          >
                            <Pencil size={12} /> Upravit
                          </button>
                          {isAdmin && r.id !== profile?.id && r.employee.active !== false && (
                            <button
                              onClick={() => handleToggleActive(r, false)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-warning/50 hover:bg-warning-light hover:text-warning-dark disabled:opacity-50"
                            >
                              <UserX size={12} /> Deaktivovat
                            </button>
                          )}
                          {isAdmin && r.id !== profile?.id && r.employee.active === false && (
                            <button
                              onClick={() => handleToggleActive(r, true)}
                              disabled={deletingId === r.id}
                              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark disabled:opacity-50"
                            >
                              <UserCheck size={12} /> Aktivovat
                            </button>
                          )}
                          {isAdmin && r.id !== profile?.id && r.employee.active === false && (
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
                          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-danger/40 hover:bg-danger-light hover:text-danger"
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
