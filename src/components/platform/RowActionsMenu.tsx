"use client";

import { MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * Jedno tlačítko „⋮" s popsanými akcemi místo řady stejně šedých ikon v řádku tabulky — u čtyř ikon vedle sebe
 * (PDF / upomínka / zaplaceno / storno) nejde bez najetí myší poznat, co která dělá. Text u položky ano.
 */
export function RowActionsMenu({ label = "Akce", children }: { label?: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label={label} title={label}>
          <MoreVertical size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DropdownMenuItem as RowAction, DropdownMenuSeparator as RowActionsSeparator };
