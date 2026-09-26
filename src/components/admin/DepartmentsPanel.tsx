"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchDepartments } from "@/lib/data";
import {
  AdminEmployeeRow,
  createDepartment,
  deleteDepartment,
  fetchCompany,
  fetchCompanyEmployees,
  mergeDuplicateDepartments,
  renameDepartment,
  updateDepartmentCapacity,
  updateDepartmentColor,
  updateDepartmentDeputyHead,
  updateDepartmentHead,
} from "@/lib/admin-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DbDepartment, LeaveColor } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";
import { LoadingCard } from "@/components/ui/skeleton";
import { PlanTag } from "@/components/shared/FeatureGate";
import { useFeatures } from "@/lib/use-features";

const colorDot: Record<LeaveColor, string> = {
  teal: "bg-teal",
  rust: "bg-rust",
  moss: "bg-moss",
  violet: "bg-violet",
  amber: "bg-amber",
  sky: "bg-sky",
  plum: "bg-plum",
  sage: "bg-sage",
  gold: "bg-gold",
  wine: "bg-wine",
  slate: "bg-slate",
  forest: "bg-forest",
};
const colorLabel: Record<LeaveColor, string> = {
  teal: "Tyrkysová",
  moss: "Mátová",
  rust: "Šedá",
  violet: "Korálová",
  amber: "Broskvová",
  sky: "Modrá",
  plum: "Fialová",
  sage: "Olivová",
  gold: "Zlatá",
  wine: "Vínová",
  slate: "Břidlicová",
  forest: "Lesní zelená",
};
const colors = Object.keys(colorLabel) as LeaveColor[];

export function DepartmentsPanel() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [employees, setEmployees] = useState<AdminEmployeeRow[]>([]);
  const [companyCapacityDefault, setCompanyCapacityDefault] = useState(70);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const [newHeadId, setNewHeadId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [editing, setEditing] = useState<DbDepartment | null>(null);
  const [deletingDept, setDeletingDept] = useState<DbDepartment | null>(null);

  async function load() {
    if (!profile) return;
    const [deps, emps, company] = await Promise.all([
      fetchDepartments(profile.company_id),
      fetchCompanyEmployees(profile.company_id),
      fetchCompany(profile.company_id),
    ]);
    setDepartments(deps);
    setEmployees(emps);
    setCompanyCapacityDefault(company.capacity_warning_percent);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  function memberCount(deptId: string) {
    return employees.filter((e) => e.department_id === deptId).length;
  }

  async function handleAdd() {
    if (!profile) return;
    if (!newName.trim()) {
      setError("Nejdřív napište název oddělení.");
      nameInput.current?.focus();
      return;
    }
    setError(null);
    try {
      await createDepartment(profile.company_id, newName.trim(), newHeadId === "none" ? null : newHeadId);
      setNewName("");
      setNewHeadId("none");
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleMerge() {
    if (!profile) return;
    setMerging(true);
    setError(null);
    try {
      await mergeDuplicateDepartments(profile.company_id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setMerging(false);
    }
  }

  if (loading) return <LoadingCard rows={4} />;

  const duplicateNames = new Set<string>();
  const seen = new Set<string>();
  for (const d of departments) {
    const key = d.name.trim().toLowerCase();
    if (seen.has(key)) duplicateNames.add(key);
    seen.add(key);
  }
  const hasDuplicates = duplicateNames.size > 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-h2">Oddělení</h2>
        {hasDuplicates && (
          <button
            onClick={handleMerge}
            disabled={merging}
            className="flex shrink-0 items-center gap-1.5 rounded border border-warning/40 bg-warning-light px-3 py-2 text-sm text-warning-dark hover:bg-warning-light/70"
          >
            <AlertTriangle size={14} /> {merging ? "Slučuji…" : "Sloučit duplicity"}
          </button>
        )}
      </div>

      <div className="mt-4 divide-y divide-line">
        {departments.map((d) => {
          const head = employees.find((e) => e.id === d.head_profile_id);
          const count = memberCount(d.id);
          return (
            <div key={d.id} className="group flex items-center gap-3 py-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colorDot[d.color])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Users size={11} /> {count} {count === 1 ? "člen" : count >= 2 && count <= 4 ? "členové" : "členů"}
                  </span>
                  {duplicateNames.has(d.name.trim().toLowerCase()) && (
                    <span className="rounded-sm bg-warning-light px-1.5 py-0.5 text-[11px] font-medium text-warning-dark">
                      duplicitní
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">{head ? `Vedoucí: ${head.name}` : "Bez vedoucího"}</div>
              </div>
              <button
                onClick={() => setEditing(d)}
                className="flex shrink-0 items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
              >
                <Pencil size={12} /> Upravit
              </button>
              <button
                onClick={() => (count > 0 ? setDeletingDept(d) : deleteDepartment(d.id, null).then(load))}
                className="shrink-0 rounded p-2 text-muted hover:bg-danger-light hover:text-danger"
                aria-label={`Smazat ${d.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        {departments.length === 0 && (
          <p className="py-3 text-sm text-muted">Zatím žádná oddělení. Napište název (např. „Obchod“ nebo „Výroba“) do pole níže a klikněte na „Přidat oddělení“.</p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <input
          ref={nameInput}
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Název nového oddělení" aria-label="Název nového oddělení"
          className="w-56 rounded border border-line px-3 py-2 text-sm"
        />
        <Select value={newHeadId} onValueChange={setNewHeadId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Vedoucí" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Bez vedoucího</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={handleAdd}>
          <Plus size={16} /> Přidat oddělení
        </Button>
      </div>

      {editing && (
        <EditDepartmentModal
          department={editing}
          employees={employees}
          companyCapacityDefault={companyCapacityDefault}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      {deletingDept && (
        <ReassignAndDeleteModal
          department={deletingDept}
          departments={departments.filter((d) => d.id !== deletingDept.id)}
          memberCount={memberCount(deletingDept.id)}
          onClose={() => setDeletingDept(null)}
          onDeleted={load}
        />
      )}
    </div>
  );
}

function EditDepartmentModal({
  department,
  employees,
  companyCapacityDefault,
  onClose,
  onSaved,
}: {
  department: DbDepartment;
  employees: AdminEmployeeRow[];
  companyCapacityDefault: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [headId, setHeadId] = useState(department.head_profile_id ?? "none");
  const [deputyId, setDeputyId] = useState(department.deputy_head_profile_id ?? "none");
  const features = useFeatures();
  const canDeputy = features.has("escalation");
  const [color, setColor] = useState<LeaveColor>(department.color);
  const [useCustomCapacity, setUseCustomCapacity] = useState(department.capacity_warning_percent !== null);
  const [capacity, setCapacity] = useState(String(department.capacity_warning_percent ?? companyCapacityDefault));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all([
        name.trim() !== department.name ? renameDepartment(department.id, name.trim()) : null,
        headId !== (department.head_profile_id ?? "none") ? updateDepartmentHead(department.id, headId === "none" ? null : headId) : null,
        deputyId !== (department.deputy_head_profile_id ?? "none")
          ? updateDepartmentDeputyHead(department.id, deputyId === "none" ? null : deputyId)
          : null,
        color !== department.color ? updateDepartmentColor(department.id, color) : null,
        updateDepartmentCapacity(department.id, useCustomCapacity ? Number(capacity) || companyCapacityDefault : null),
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
      <DialogContent title={`Upravit — ${department.name}`}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Název</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-line px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Barva v kalendáři</label>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  title={colorLabel[c]}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform",
                    colorDot[c],
                    color === c ? "ring-2 ring-ink ring-offset-2" : "hover:scale-110"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Vedoucí</label>
              <Select value={headId} onValueChange={setHeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez vedoucího</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                Zástupce vedoucího {!features.loading && !canDeputy && <PlanTag feature="escalation" />}
              </label>
              <Select value={deputyId} onValueChange={setDeputyId} disabled={!canDeputy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez zástupce</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={useCustomCapacity} onChange={(e) => setUseCustomCapacity(e.target.checked)} className="h-4 w-4 accent-teal" />
              Vlastní kapacitní pravidlo pro toto oddělení
            </label>
            <p className="mt-1 text-xs text-muted">
              Jinak platí firemní výchozí hodnota ({companyCapacityDefault} %). Manažer dostane varování při schvalování, když bude
              mimo víc lidí z oddělení, než je limit.
            </p>
            {useCustomCapacity && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-20 rounded border border-line px-3 py-2 text-sm"
                />
                <span className="text-sm text-muted">% oddělení současně mimo</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={submitting || !name.trim()}>
              {submitting ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReassignAndDeleteModal({
  department,
  departments,
  memberCount,
  onClose,
  onDeleted,
}: {
  department: DbDepartment;
  departments: DbDepartment[];
  memberCount: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [targetId, setTargetId] = useState("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteDepartment(department.id, targetId === "none" ? null : targetId);
      onDeleted();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Smazat oddělení ${department.name}`}>
        <div className="space-y-4">
          <p className="flex items-start gap-2 rounded border border-warning/30 bg-warning-light p-3 text-sm text-warning-dark">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            Oddělení {department.name} obsahuje {memberCount} {memberCount === 1 ? "zaměstnance" : "zaměstnanců"}. Vyberte, kam je
            přesunout.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Přesunout do</label>
            <Select value={targetId} onValueChange={setTargetId}>
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

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button variant="danger" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Mažu…" : "Přesunout a smazat oddělení"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
