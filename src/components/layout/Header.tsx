"use client";

import { useEffect } from "react";
import { HelpCircle, Menu, Plus } from "lucide-react";
import { TOGGLE_NAV_EVENT } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TOGGLE_HELP_EVENT } from "@/components/layout/HelpDrawer";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { Button } from "@/components/ui/button";
import { emitDataChanged } from "@/lib/events";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  useEffect(() => {
    document.title = `${title} – Dodio`;
  }, [title]);

  return (
    <header className="flex items-start justify-between gap-3 border-b border-line bg-paper px-4 py-4 sm:gap-4 sm:px-8 sm:py-6">
      <button
        onClick={() => window.dispatchEvent(new Event(TOGGLE_NAV_EVENT))}
        className="-ml-1 mt-0.5 shrink-0 rounded p-2 text-ink hover:bg-white lg:hidden"
        aria-label="Otevřít menu"
      >
        <Menu size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <RequestLeaveModal
          trigger={
            <Button variant="secondary" className="px-3 text-sm sm:px-5" aria-label="Nová žádost" data-tour="header-new-request">
              <Plus size={15} /> <span className="hidden sm:inline">Nová žádost</span>
            </Button>
          }
          onSaved={emitDataChanged}
        />
        <button
          onClick={() => window.dispatchEvent(new Event(TOGGLE_HELP_EVENT))}
          className="rounded p-2 text-muted hover:bg-white hover:text-ink"
          aria-label="Rychlá nápověda"
        >
          <HelpCircle size={19} />
        </button>
        <div data-tour="header-notifications">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
