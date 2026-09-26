"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { DbLeaveType } from "@/lib/supabase/types";
import { leaveIconFor, LeaveTypeIcon } from "@/components/shared/LeaveTypeIcon";
import { emitDataChanged } from "@/lib/events";
import { cn } from "@/lib/utils";

/** Nejčastější druhy absence, které se nabízejí rovnou v rozbalovací části tlačítka. */
const QUICK_KEYS = ["dovolena", "home_office", "sick"];

/**
 * Jediné místo pro založení žádosti: velké tlačítko „Nová žádost“ otevře formulář, šipka vedle něj nabídne
 * nejčastější druhy absence (Dovolená, Home Office, Sick Day) a formulář se otevře rovnou s nimi.
 */
export function NewRequestSplit() {
  const { profile } = useAuth();
  const [types, setTypes] = useState<DbLeaveType[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [typeId, setTypeId] = useState<string | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("leave_types")
      .select("*")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .then(({ data }) => setTypes((data as DbLeaveType[]) ?? []));
  }, [profile]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const quick = QUICK_KEYS.map((k) => types.find((t) => t.key === k)).filter((t): t is DbLeaveType => !!t);

  function openWith(id?: string) {
    setTypeId(id);
    setMenuOpen(false);
    setModalOpen(true);
  }

  const btn = "flex items-center gap-1.5 border border-line bg-white text-sm font-medium text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink";

  return (
    <div ref={wrapRef} className="relative" data-tour="header-new-request">
      <div className="flex">
        <button type="button" onClick={() => openWith(undefined)} aria-label="Nová žádost" className={cn(btn, "rounded-l px-3 py-2 sm:px-4", quick.length === 0 && "rounded-r")}>
          <Plus size={15} /> <span className="hidden sm:inline">Nová žádost</span>
        </button>
        {quick.length > 0 && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Vybrat druh absence"
            className={cn(btn, "-ml-px rounded-r px-2 py-2")}
          >
            <ChevronDown size={15} className={cn("transition-transform", menuOpen && "rotate-180")} />
          </button>
        )}
      </div>
      {menuOpen && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-48 rounded border border-line bg-white p-1 shadow-lg">
          {quick.map((t) => {
            const icon = leaveIconFor(t.key);
            return (
              <button key={t.id} role="menuitem" type="button" onClick={() => openWith(t.id)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-paper">
                {icon ? <LeaveTypeIcon name={icon} size={15} /> : <Plus size={15} />}
                {t.label}
              </button>
            );
          })}
        </div>
      )}
      {modalOpen && (
        <RequestLeaveModal
          trigger={null}
          open={modalOpen}
          onOpenChange={setModalOpen}
          prefill={typeId ? { leave_type_id: typeId } : undefined}
          onSaved={() => {
            setModalOpen(false);
            emitDataChanged();
          }}
        />
      )}
    </div>
  );
}
