"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Gift, GripVertical, Lock, Plus, Settings2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchLeaveTypes } from "@/lib/data";
import { createLeaveType, deleteLeaveType, fetchCompany, setLeaveTypeOrder, updateCompany, updateLeaveType } from "@/lib/admin-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DbCompany, DbLeaveType, LeaveColor } from "@/lib/supabase/types";
import { cn, errorMessage } from "@/lib/utils";
import { SaveStatusBar, useSaveStatus } from "@/components/shared/SaveStatus";
import { LoadingCard } from "@/components/ui/skeleton";
import { SeniorityCard } from "@/components/admin/SeniorityCard";
import { FeatureGate } from "@/components/shared/FeatureGate";
import { setPresenceKeys } from "@/lib/leave-kinds";

// These two keys are load-bearing (hardcoded into onboarding, invite-claim
// and every balance calculation) — protected from deletion at the DB level
// too, but hiding the delete button here avoids a confusing round-trip.
const PROTECTED_KEYS = new Set(["dovolena", "sick"]);

const colors: LeaveColor[] = ["teal", "moss", "rust", "violet", "amber", "sky", "plum", "sage", "gold", "wine", "slate", "forest"];
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
// Czech, visually-accurate names — the raw token keys (teal/rust/moss/violet/
// amber) are leftovers from before the Dodio rebrand and no longer match
// what they actually render as (e.g. "violet" is now a coral tone).
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

const countsLabel = {
  vacation: "Čerpá dovolenou",
  sick: "Čerpá sick days",
  none: "Nečerpá nic (jen evidence)",
} as const;

function slugify(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function LeaveTypesPanel() {
  const { profile } = useAuth();
  const [types, setTypes] = useState<DbLeaveType[]>([]);
  const [company, setCompany] = useState<DbCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const save = useSaveStatus();

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<LeaveColor | null>(null); // null = automaticky první nepoužitá
  const [newCounts, setNewCounts] = useState<"vacation" | "sick" | "none">("none");

  async function load() {
    if (!profile) return;
    const [lt, c] = await Promise.all([fetchLeaveTypes(profile.company_id), fetchCompany(profile.company_id)]);
    setPresenceKeys(lt.filter((t) => t.counts_as_present).map((t) => t.key));
    setTypes(lt);
    setCompany(c);
    setLoading(false);
  }

  async function patchDefaults(fields: Partial<DbCompany>) {
    if (!profile || !company) return;
    setCompany({ ...company, ...fields });
    await save.run(() => updateCompany(profile.company_id, fields));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleAdd() {
    if (!profile || !newLabel.trim()) return;
    setError(null);
    try {
      await createLeaveType(profile.company_id, {
        key: slugify(newLabel) || `typ_${Date.now()}`,
        label: newLabel.trim(),
        color: effectiveNewColor,
        counts_against: newCounts,
      });
      setNewLabel("");
      setNewColor(null);
      setNewCounts("none");
      load();
    } catch {
      setError("Typ absence se nepodařilo přidat — možná už podobný existuje.");
    }
  }

  async function handleUpdate(t: DbLeaveType, patch: Partial<DbLeaveType>) {
    setTypes((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    await save.run(() => updateLeaveType(t.id, patch));
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteLeaveType(id);
      load();
    } catch (e) {
      const raw = errorMessage(e);
      // Our own guard_leave_type_delete trigger message is already friendly;
      // anything else here is a plain FK violation from requests using this type.
      setError(raw.includes("nelze smazat") ? raw : "Typ absence nelze smazat — existují u něj žádosti o absenci.");
    }
  }

  /** Moves one type to the position of another; the resulting order is what employees see in the request dropdown. */
  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = types.findIndex((t) => t.id === fromId);
    const to = types.findIndex((t) => t.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...types];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTypes(next);
    try {
      await save.run(() => setLeaveTypeOrder(next.map((t) => t.id)));
    } catch (e) {
      setError(errorMessage(e));
      load();
    }
  }

  function handleMove(index: number, direction: -1 | 1) {
    const other = visibleTypes[index + direction];
    if (other) reorder(visibleTypes[index].id, other.id);
  }

  if (loading || !company) return <LoadingCard rows={8} />;

  const inactiveTypes = types.filter((t) => !t.active);
  const visibleTypes = showInactive ? types : types.filter((t) => t.active);

  const usedColors = new Set(types.map((t) => t.color));
  const availableForNew = colors.filter((c) => !usedColors.has(c));
  const effectiveNewColor: LeaveColor = newColor ?? availableForNew[0] ?? "teal";
  const usedBy = (c: LeaveColor, exceptId?: string) => types.filter((t) => t.color === c && t.id !== exceptId && t.active).map((t) => t.label);

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
            <Gift size={15} />
          </div>
          <h2 className="font-display text-h2">Výchozí nároky pro nové zaměstnance</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Použije se při pozvání nového zaměstnance (odkazem) nebo založení firmy. Existujícím lidem se dá nárok upravit v záložce Uživatelé.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Dovolená / rok</label>
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={company.default_vacation_days}
              onBlur={(e) => patchDefaults({ default_vacation_days: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Sick days / rok</label>
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={company.default_sick_days}
              onBlur={(e) => patchDefaults({ default_sick_days: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Home Office / rok (0 = bez limitu)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              defaultValue={company.default_home_office_days}
              onBlur={(e) => patchDefaults({ default_home_office_days: Number(e.target.value) })}
              className="w-full rounded border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={company.prorate_new_hires}
            onChange={(e) => patchDefaults({ prorate_new_hires: e.target.checked })}
            className="h-4 w-4"
          />
          Poměrná dovolená pro nováčky během roku (krátí se podle měsíce nástupu — je-li vyplněné datum nástupu, jinak podle dne založení účtu)
        </label>
      </div>

      <FeatureGate feature="seniority" description="Automatický příplatek k ročnímu nároku podle počtu let ve firmě a poměrná dovolená pro nováčky.">
        <SeniorityCard companyId={company.id} enabled={company.seniority_enabled ?? false} rules={company.seniority_rules ?? []} defaultVacation={company.default_vacation_days} />
      </FeatureGate>

      <div className="card p-5">
        <h2 className="font-display text-h2">Typy absencí</h2>

        <div className="mt-4 space-y-2">
          {visibleTypes.map((t, i) => {
            const locked = PROTECTED_KEYS.has(t.key);
            const expanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => {
                  setDragId(t.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overId !== t.id) setOverId(t.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) reorder(dragId, t.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={cn(
                  "rounded border",
                  locked ? "border-line bg-paper" : "border-line",
                  !t.active && "opacity-50",
                  dragId === t.id && "opacity-40",
                  overId === t.id && dragId && dragId !== t.id && "border-teal ring-1 ring-teal"
                )}
              >
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <span className="cursor-grab text-muted active:cursor-grabbing" title="Přetažením změníte pořadí" aria-hidden="true">
                    <GripVertical size={16} />
                  </span>
                  <div className="flex shrink-0 flex-col">
                    <button
                      onClick={() => handleMove(i, -1)}
                      disabled={i === 0}
                      className="rounded text-muted hover:text-ink disabled:opacity-30"
                      aria-label={`Posunout ${t.label} nahoru`}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => handleMove(i, 1)}
                      disabled={i === visibleTypes.length - 1}
                      className="rounded text-muted hover:text-ink disabled:opacity-30"
                      aria-label={`Posunout ${t.label} dolů`}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  <span className={cn("h-3 w-3 shrink-0 rounded-sm", colorDot[t.color])} />
                  <input
                    defaultValue={t.label}
                    onBlur={(e) => e.target.value.trim() && handleUpdate(t, { label: e.target.value.trim() })}
                    className="w-48 rounded border border-line bg-white px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-muted">{countsLabel[t.counts_against]}</span>
                  {!t.active && (
                    <span className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] font-medium text-muted">neaktivní</span>
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <Switch checked={t.active} onCheckedChange={(v) => handleUpdate(t, { active: v })} label={`Aktivní: ${t.label}`} />
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className={cn("rounded p-2 hover:bg-paper", expanded ? "text-teal-dark" : "text-muted")}
                      aria-label={`Pokročilá pravidla pro ${t.label}`}
                    >
                      <Settings2 size={16} />
                    </button>
                    {locked ? (
                      <span className="flex items-center gap-1.5 rounded p-2 text-muted" title="Výchozí typ absence nelze smazat">
                        <Lock size={15} />
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="rounded p-2 text-muted hover:bg-danger-light hover:text-danger"
                        aria-label={`Smazat ${t.label}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-4 border-t border-line p-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Barva v kalendáři</label>
                      <div className="flex flex-wrap gap-1.5">
                        {colors.map((c) => {
                          const others = usedBy(c, t.id);
                          return (
                            <button
                              key={c}
                              onClick={() => handleUpdate(t, { color: c })}
                              title={others.length ? `${colorLabel[c]} — používá také: ${others.join(", ")}` : colorLabel[c]}
                              aria-label={colorLabel[c]}
                              className={cn(
                                "relative h-6 w-6 rounded-full transition-transform",
                                colorDot[c],
                                t.color === c ? "ring-2 ring-ink ring-offset-2" : "hover:scale-110",
                                others.length > 0 && t.color !== c && "opacity-50"
                              )}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-muted">Zvýrazněné barvy jsou volné, zesvětlené už používá jiný typ (můžete je použít i tak).</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Čerpání</label>
                      <Select
                        value={t.counts_against}
                        onValueChange={(v) => handleUpdate(t, { counts_against: v as "vacation" | "sick" | "none" })}
                        disabled={locked}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(countsLabel) as (keyof typeof countsLabel)[]).map((k) => (
                            <SelectItem key={k} value={k}>
                              {countsLabel[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {locked && <p className="mt-1 text-xs text-muted">U výchozích typů nelze měnit — používá se v každém výpočtu zůstatku.</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                      <label className="flex items-center justify-between gap-2 text-sm">
                        Vyžaduje schválení
                        <Switch checked={t.requires_approval} onCheckedChange={(v) => handleUpdate(t, { requires_approval: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        Schválit automaticky do (dnů)
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder="vypnuto"
                          aria-label="Automaticky schválit do počtu dnů"
                          defaultValue={t.auto_approve_max_days ?? ""}
                          disabled={!t.requires_approval}
                          onBlur={(e) => handleUpdate(t, { auto_approve_max_days: e.target.value === "" ? null : Number(e.target.value) })}
                          className="w-20 rounded border border-line px-2 py-1 text-right text-sm disabled:opacity-50"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm" title="Člověk při této absenci pracuje (Home Office, služební cesta): nesnižuje kapacitu týmu a nepočítá se jako nepřítomný.">
                        Počítá se jako práce (nesnižuje kapacitu)
                        <Switch checked={t.counts_as_present} onCheckedChange={(v) => handleUpdate(t, { counts_as_present: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm" title="Kód nebo zkratka tohoto druhu nepřítomnosti ve vašem mzdovém systému. Uvádí se v mzdovém podkladu (Exporty).">
                        Kód pro mzdy
                        <input
                          maxLength={20}
                          placeholder="např. D"
                          aria-label="Kód pro mzdy"
                          defaultValue={t.payroll_code ?? ""}
                          onBlur={(e) => handleUpdate(t, { payroll_code: e.target.value.trim() || null })}
                          className="w-24 rounded border border-line px-2 py-1 text-right text-sm"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        Placená absence
                        <Switch checked={t.paid} onCheckedChange={(v) => handleUpdate(t, { paid: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        Povolit půlden
                        <Switch checked={t.allow_half_day} onCheckedChange={(v) => handleUpdate(t, { allow_half_day: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm" title="Kolegové uvidí jen „Nepřítomen“. Konkrétní typ uvidí dotčený zaměstnanec, jeho nadřízený a admin.">
                        Ostatním zobrazit jen „Nepřítomen“
                        <Switch checked={t.hide_from_colleagues} onCheckedChange={(v) => handleUpdate(t, { hide_from_colleagues: v })} />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        Povolit hodiny
                        <Switch checked={t.allow_hours} onCheckedChange={(v) => handleUpdate(t, { allow_hours: v })} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {inactiveTypes.length > 0 && (
          <button
            onClick={() => setShowInactive((v) => !v)}
            aria-expanded={showInactive}
            className="mt-3 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
          >
            {showInactive ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Neaktivní typy absencí ({inactiveTypes.length})
          </button>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Nový typ</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Např. Dovolená navíc" aria-label="Např. Dovolená navíc"
              className="w-48 rounded border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Barva</label>
            <div className="flex flex-wrap gap-1.5 rounded border border-line px-2 py-2">
              {colors.map((c) => {
                const others = usedBy(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    title={others.length ? `${colorLabel[c]} — používá také: ${others.join(", ")}` : colorLabel[c]}
                    aria-label={colorLabel[c]}
                    className={cn(
                      "h-5 w-5 rounded-full transition-transform",
                      colorDot[c],
                      effectiveNewColor === c ? "ring-2 ring-ink ring-offset-1" : "hover:scale-110",
                      others.length > 0 && effectiveNewColor !== c && "opacity-50"
                    )}
                  />
                );
              })}
            </div>
          </div>
          <Select value={newCounts} onValueChange={(v) => setNewCounts(v as "vacation" | "sick" | "none")}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(countsLabel) as (keyof typeof countsLabel)[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {countsLabel[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleAdd} disabled={!newLabel.trim()}>
            <Plus size={16} /> Přidat typ
          </Button>
        </div>
      </div>

      <SaveStatusBar status={save.status} error={save.error} />
    </div>
  );
}
