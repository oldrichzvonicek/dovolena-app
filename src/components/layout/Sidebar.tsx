"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardList, Clock, Users, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const mainNav = [
  { href: "/dashboard", label: "Nástěnka", icon: LayoutDashboard },
  { href: "/calendar", label: "Týmový kalendář", icon: CalendarDays },
  { href: "/requests", label: "Moje žádosti", icon: ClipboardList },
];

const managerNav = [
  { href: "/approvals", label: "Ke schválení", icon: Clock },
  { href: "/team", label: "Můj tým", icon: Users },
];

const adminNav = [
  { href: "/admin/exports", label: "Rychlé přehledy & Exporty", icon: BarChart3 },
  { href: "/admin/settings", label: "Nastavení firmy", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded px-3 py-2 text-sm transition-colors",
        active ? "bg-teal-light text-teal font-medium" : "text-ink hover:bg-paper"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon size={17} strokeWidth={2} />
        {label}
      </span>
      {!!badge && (
        <span className="rounded-full bg-rust px-1.5 py-0.5 text-[11px] font-semibold text-white leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isManager) return;
    const supabase = createClient();
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [isManager]);

  if (!profile) return null;

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-ink font-display text-sm text-white">
          D
        </div>
        <div>
          <div className="font-display text-base leading-tight">Dovolená</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>

        {isManager && (
          <div>
            <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Manažer
            </div>
            <div className="space-y-1">
              {managerNav.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  badge={item.href === "/approvals" ? pendingCount : undefined}
                  active={pathname === item.href}
                />
              ))}
            </div>
          </div>
        )}

        {isAdmin && (
          <div>
            <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Administrace
            </div>
            <div className="space-y-1">
              {adminNav.map((item) => (
                <NavLink key={item.href} {...item} active={pathname === item.href} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-line px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal">
          {profile.avatar_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{profile.name}</div>
          <div className="truncate text-xs text-muted capitalize">{profile.role}</div>
        </div>
        <button onClick={signOut} className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label="Odhlásit se">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
