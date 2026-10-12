"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, History, LayoutDashboard, ListChecks, LogOut, Menu, Scale, ShieldCheck, Tags, UserRoundCheck, Users2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppLockup } from "@/components/shared/AppLockup";
import { CommandPalette } from "./CommandPalette";
import { platformFetch } from "./api";

const ICONS = { dashboard: LayoutDashboard, companies: Building2, invoices: FileText, plans: Tags, gdpr: UserRoundCheck, legal: Scale, jobs: ListChecks, audit: History, team: Users2 };
export type NavKey = keyof typeof ICONS;
export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
}
export interface NavGroup {
  /** Bez nadpisu pro první skupinu (Provoz) — nepotřebuje popisek, je vždy první a nejpoužívanější. */
  title?: string;
  items: NavItem[];
}

export function PlatformSidebar({ groups, user, canSearchCompanies }: { groups: NavGroup[]; user: { name: string; email: string; roleLabel: string }; canSearchCompanies: boolean }) {
  const raw = usePathname();
  // Podle způsobu přepisu adresy může cesta začínat /platform — pro porovnání se odřízne.
  const pathname = raw.replace(/^\/platform(?=\/|$)/, "") || "/";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await platformFetch("/auth/logout", { method: "POST", json: {} });
    } finally {
      window.location.href = "/login";
    }
  }

  const nav = (
    <nav className="flex flex-col gap-3 px-2 py-3" aria-label="Hlavní menu">
      {groups.map((g, gi) => (
        <div key={g.title ?? gi}>
          {g.title && <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.title}</div>}
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.key];
              const active = it.href === "/" ? pathname === "/" : pathname === it.href || pathname.startsWith(`${it.href}/`);
              return (
                <Link key={it.key} href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors", active ? "bg-teal-light font-medium text-teal-dark" : "text-ink hover:bg-paper")}>
                  <Icon size={17} strokeWidth={2} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <AppLockup className="h-7" />
        <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Zavřít menu" : "Otevřít menu"} className="rounded p-2 hover:bg-paper">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>
      <aside className={cn("fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-line bg-surface pt-14 md:static md:flex md:pt-0", open ? "flex" : "hidden md:flex")}>
        <div className="hidden items-center justify-between gap-2 px-4 py-4 md:flex">
          <AppLockup className="h-8" />
          {/* Ztlumeno oproti dřívějšímu plnému černému odznaku — hlavní varování teď nese pruh prostředí nahoře stránky, tohle je jen orientační značka. */}
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted">
            <ShieldCheck size={12} /> Admin
          </span>
        </div>
        <div className="px-3 pt-3">
          <CommandPalette canSearchCompanies={canSearchCompanies} />
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-line p-3">
          <div className="mb-2 px-1">
            <div className="truncate text-sm font-medium">{user.name || user.email}</div>
            <div className="truncate text-caption text-muted">{user.roleLabel} · {user.email}</div>
          </div>
          <button onClick={logout} disabled={busy} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-ink hover:bg-paper disabled:opacity-50">
            <LogOut size={16} /> Odhlásit se
          </button>
        </div>
      </aside>
    </>
  );
}
