"use client";

import { useEffect } from "react";
import { HelpCircle, Menu, Search } from "lucide-react";
import { TOGGLE_NAV_EVENT } from "@/components/layout/Sidebar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TOGGLE_HELP_EVENT } from "@/components/layout/HelpDrawer";
import { TOGGLE_COMMAND_EVENT } from "@/components/layout/CommandPalette";
import { NewRequestSplit } from "@/components/layout/NewRequestSplit";

export function Header({ title, subtitle, hideNewRequest }: { title: string; subtitle?: string; hideNewRequest?: boolean }) {
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
        {/* Na mobilu se raději zalomí na 2 řádky, než aby se dlouhé jméno v pozdravu utnulo na "Ol…". */}
        <h1 className="break-words font-display text-xl sm:truncate sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 hidden text-sm text-muted sm:block">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!hideNewRequest && <NewRequestSplit />}
        {/* Rychlé hledání (Cmd/Ctrl+K) dřív šlo otevřít jen klávesovou zkratkou, o které nikdo nevěděl — teď má i viditelné tlačítko. */}
        <button
          onClick={() => window.dispatchEvent(new Event(TOGGLE_COMMAND_EVENT))}
          className="hidden items-center gap-1.5 rounded border border-line bg-white px-2.5 py-1.5 text-sm text-muted hover:bg-paper hover:text-ink sm:flex"
          aria-label="Hledat (Ctrl+K)"
        >
          <Search size={15} />
          <span className="hidden text-xs lg:inline">Hledat</span>
          <kbd className="hidden rounded border border-line bg-paper px-1 text-[10px] font-medium text-muted lg:inline">Ctrl K</kbd>
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event(TOGGLE_HELP_EVENT))}
          className="hidden rounded p-2 text-muted hover:bg-white hover:text-ink sm:block"
          aria-label="Rychlá nápověda"
        >
          <HelpCircle size={19} />
        </button>
        <ThemeToggle />
        <div data-tour="header-notifications">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
