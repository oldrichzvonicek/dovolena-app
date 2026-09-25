"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { DbLeaveType } from "@/lib/supabase/types";
import { leaveIconFor, LeaveTypeIcon } from "@/components/shared/LeaveTypeIcon";

const QUICK_KEYS = ["dovolena", "home_office", "sick"];

/** One-click chips for the most common absence types. The global "+ Nová žádost" in the header stays the single primary action. */
export function NewRequestButton({ onSaved }: { onSaved?: () => void }) {
  const { profile } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<DbLeaveType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .then(({ data }) => setLeaveTypes((data as DbLeaveType[]) ?? []));
  }, [profile]);

  const quickTypes = QUICK_KEYS.map((k) => leaveTypes.find((t) => t.key === k)).filter((t): t is DbLeaveType => !!t);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted">Rychlá žádost:</span>
      {quickTypes.map((t) => {
        const icon = leaveIconFor(t.key);
        return (
          <button
            key={t.id}
            onClick={() => {
              setSelectedTypeId(t.id);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-sm hover:border-teal/40 hover:bg-teal-light hover:text-teal-dark"
          >
            {icon ? <LeaveTypeIcon name={icon} size={14} /> : <Plus size={14} />}
            {t.label}
          </button>
        );
      })}

      {modalOpen && (
        <RequestLeaveModal
          trigger={null}
          open={modalOpen}
          onOpenChange={setModalOpen}
          prefill={selectedTypeId ? { leave_type_id: selectedTypeId } : undefined}
          onSaved={() => {
            setModalOpen(false);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}
