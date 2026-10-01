"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LeaveBadge } from "@/components/ui/badge";
import { formatRange, dayWord } from "@/lib/working-days";
import { formatNumber } from "@/lib/utils";
import { fetchLeavePlans, deleteLeavePlan, submitLeavePlan, LeavePlan } from "@/lib/leave-plans";
import { LeaveColor } from "@/lib/supabase/types";
import { PlanLeaveModal } from "@/components/dashboard/PlanLeaveModal";
import { confirmDialog } from "@/components/shared/ConfirmHost";
import { showToast } from "@/lib/toast";
import { errorMessage } from "@/lib/utils";
import { emitDataChanged } from "@/lib/events";

/**
 * "Naplánovat rok dopředu" — soukromé návrhy (leave_plans), jen pro autora. Samostatná sekce, ne řádky v
 * tabulce žádostí: pojmově je to jiná věc (nezávazná poznámka vs. podaná žádost) a takhle to nejde splést.
 */
export function MyLeavePlans() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<LeavePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!profile) return;
    fetchLeavePlans(profile.id)
      .then(setPlans)
      .finally(() => setLoading(false));
  }

  useEffect(load, [profile]);

  async function handleSubmitPlan(plan: LeavePlan) {
    if (!profile) return;
    setBusyId(plan.id);
    setError(null);
    try {
      const result = await submitLeavePlan(plan, profile);
      showToast(result === "approved" ? "Absence je zapsaná a schválená automaticky." : "Žádost byla odeslána ke schválení.", "success");
      load();
      emitDataChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(plan: LeavePlan) {
    if (!(await confirmDialog("Smazat tento návrh?", { confirmLabel: "Smazat", danger: true }))) return;
    setBusyId(plan.id);
    try {
      await deleteLeavePlan(plan.id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return null;

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-h2">Můj plán na rok</h2>
          <p className="mt-0.5 text-xs text-muted">Soukromé návrhy termínů — vidíte je jen vy. Až budete chtít, jedním klikem se podá skutečná žádost.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-sm text-muted hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
        >
          <CalendarPlus size={14} /> Naplánovat volno
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {plans.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Zatím žádné návrhy. Rozplánujte si volno na celý rok, aniž byste hned něco odesílali.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {plans.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
              <LeaveBadge type={{ key: p.leave_type.key, label: p.leave_type.label, color: p.leave_type.color as LeaveColor }} className="shrink-0" />
              <span className="text-sm font-medium">{formatRange(p.start_date, p.end_date)}</span>
              <span className="text-xs text-muted">
                {formatNumber(Number(p.working_days))} {dayWord(Number(p.working_days))}
              </span>
              {p.note && <span className="min-w-0 max-w-[16rem] truncate text-xs text-muted">{p.note}</span>}
              <span className="ml-auto flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => handleSubmitPlan(p)}
                  disabled={busyId === p.id}
                  className="flex items-center gap-1 rounded border border-teal/40 bg-teal-light px-2 py-1 text-xs font-medium text-teal-dark hover:bg-teal/20 disabled:opacity-50"
                >
                  <Send size={12} /> {busyId === p.id ? "Podávám…" : "Podat žádost"}
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={busyId === p.id}
                  aria-label="Smazat návrh"
                  className="rounded border border-line p-1.5 text-muted hover:border-danger/40 hover:bg-danger-light hover:text-danger disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <PlanLeaveModal open={modalOpen} onOpenChange={setModalOpen} onSaved={load} existing={plans} />
    </div>
  );
}
