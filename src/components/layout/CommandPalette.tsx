"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  Download,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const mainItems: Item[] = [
  { href: "/dashboard", label: "Nástěnka", icon: LayoutDashboard, group: "Navigace" },
  { href: "/calendar", label: "Týmový kalendář", icon: CalendarDays, group: "Navigace" },
  { href: "/requests", label: "Moje žádosti", icon: ClipboardList, group: "Navigace" },
];
const managerItems: Item[] = [
  { href: "/approvals", label: "Ke schválení", icon: Clock, group: "Manažer" },
  { href: "/team", label: "Můj tým", icon: Users, group: "Manažer" },
];
const adminItems: Item[] = [
  { href: "/admin/overview", label: "Přehled", icon: BarChart3, group: "Administrace" },
  { href: "/admin/exports", label: "Exporty", icon: Download, group: "Administrace" },
  { href: "/admin/settings", label: "Nastavení firmy — Uživatelé", icon: Settings, group: "Administrace" },
  { href: "/admin/settings", label: "Nastavení firmy — Oddělení", icon: Settings, group: "Administrace" },
  { href: "/admin/settings", label: "Nastavení firmy — Typy absencí", icon: Settings, group: "Administrace" },
  { href: "/admin/settings", label: "Nastavení firmy — Provoz", icon: Settings, group: "Administrace" },
  { href: "/admin/settings", label: "Nastavení firmy — Fakturace", icon: Settings, group: "Administrace" },
];
const helpItem: Item = { href: "/help", label: "Nápověda", icon: HelpCircle, group: "Navigace" };

/** Global Cmd+K / Ctrl+K quick navigation — mounted once in the app shell. */
export function CommandPalette() {
  const { profile } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo(() => {
    const isManager = profile?.role === "manager" || profile?.role === "admin";
    const isAdmin = profile?.role === "admin";
    return [...mainItems, ...(isManager ? managerItems : []), ...(isAdmin ? adminItems : []), helpItem];
  }, [profile]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  function go(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 pt-[15vh]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-lg border border-line bg-white shadow-[0_8px_30px_rgba(22,35,59,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && filtered[activeIndex]) {
                go(filtered[activeIndex]);
              }
            }}
            placeholder="Přejít na…"
            className="w-full text-sm outline-none"
          />
          <kbd className="shrink-0 rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nic jsme nenašli.</p>}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={`${item.href}-${item.label}`}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm",
                  i === activeIndex ? "bg-teal-light text-teal-dark" : "text-ink"
                )}
              >
                <Icon size={15} className="shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
