"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardList, Clock, Users, BarChart3, Download, Settings, HelpCircle, LogOut, X, ChevronDown, Users2, Building2, Tags, SlidersHorizontal, CreditCard, History, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useOnDataChanged } from "@/lib/events";
import { AppLogo } from "@/components/shared/AppLogo";

export const TOGGLE_NAV_EVENT = "dodio:toggle-nav";

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
  { href: "/admin/overview", label: "Analytika", icon: BarChart3 },
  { href: "/admin/exports", label: "Exporty", icon: Download },
];

// Nastavení firmy — sekce přímo v hlavním menu (stránka /admin/settings?sekce=…).
const settingsGroups = [
  {
    title: "Lidé & Organizace",
    items: [
      { key: "users", label: "Uživatelé", icon: Users2 },
      { key: "departments", label: "Oddělení", icon: Building2 },
    ],
  },
  {
    title: "Pravidla & Absence",
    items: [
      { key: "leave-types", label: "Typy absencí", icon: Tags },
      { key: "general", label: "Provoz & kalendář", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Správa účtu",
    items: [
      { key: "billing", label: "Fakturace & tarify", icon: CreditCard },
      { key: "integrations", label: "Integrace", icon: Plug },
      { key: "audit", label: "Historie změn", icon: History },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
  tourId,
  indent,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  active: boolean;
  tourId?: string;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      data-tour={tourId ?? `nav-${href.replace(/^\//, "").replace(/\//g, "-")}`}
      className={cn(
        "flex items-center justify-between rounded py-2 pr-3 text-sm transition-colors",
        indent ? "pl-7" : "pl-3",
        active ? "bg-teal-light text-teal-dark font-medium" : "text-ink hover:bg-paper"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon size={17} strokeWidth={2} />
        {label}
      </span>
      {!!badge && (
        <span className="rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-semibold text-white leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const settingsSection = pathname === "/admin/settings" ? searchParams.get("sekce") ?? "users" : null;
  const { profile, signOut } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  function loadPending() {
    if (!isManager) return;
    createClient()
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }

  useEffect(loadPending, [isManager]); // eslint-disable-line react-hooks/exhaustive-deps
  useOnDataChanged(loadPending);

  useEffect(() => {
    const toggle = () => setMobileOpen((v) => !v);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener(TOGGLE_NAV_EVENT, toggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(TOGGLE_NAV_EVENT, toggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!profile) return;
    createClient()
      .from("companies")
      .select("logo_url")
      .eq("id", profile.company_id)
      .single()
      .then(({ data }) => setLogoUrl(data?.logo_url ?? null));
  }, [profile]);

  if (!profile) return null;

  const inner = (
    <>
      <Link href="/dashboard" aria-label="Přejít na Nástěnku" className="flex items-center border-b border-line px-5 py-5 hover:bg-paper">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo firmy" className="h-9 max-w-full object-contain" />
        ) : (
          <div className="flex items-center gap-2">
            <AppLogo className="h-8 w-8" />
            <div className="font-display text-base leading-tight">Dodio</div>
          </div>
        )}
      </Link>

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
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen || settingsSection !== null}
              aria-controls="sidebar-settings"
              className="mt-1 flex w-full items-center justify-between rounded px-3 py-2 text-sm text-ink transition-colors hover:bg-paper"
            >
              <span className="flex items-center gap-2.5">
                <Settings size={17} strokeWidth={2} />
                Nastavení firmy
              </span>
              <ChevronDown size={15} className={cn("text-muted transition-transform", (settingsOpen || settingsSection !== null) && "rotate-180")} />
            </button>
            {(settingsOpen || settingsSection !== null) && (
              <div id="sidebar-settings" className="mt-0.5 space-y-0.5">
                {settingsGroups
                  .flatMap((g) => g.items)
                  .map((i) => (
                    <NavLink
                      key={i.key}
                      href={`/admin/settings?sekce=${i.key}`}
                      label={i.label}
                      icon={i.icon}
                      indent
                      active={settingsSection === i.key}
                      tourId={i.key === "users" ? "nav-admin-settings" : undefined}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="px-3 pb-2">
        <NavLink href="/help" label="Nápověda" icon={HelpCircle} active={pathname === "/help"} />
        <div data-tour="sidebar-cmdk" className="mt-1 flex items-center gap-1.5 px-3 py-1 text-[11px] text-muted">
          <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-sans">Ctrl</kbd>+
          <kbd className="rounded border border-line bg-paper px-1 py-0.5 font-sans">K</kbd>
          rychlá navigace
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-t border-line px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal-dark">
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

      <div className="flex items-center gap-1.5 border-t border-line px-5 py-2 text-[11px] text-muted">
        <AppLogo className="h-3 w-3" /> Poháněno aplikací Dodio
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-white lg:flex">{inner}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigace">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Zavřít menu"
              className="absolute right-2 top-2 rounded p-2 text-muted hover:bg-paper hover:text-ink"
            >
              <X size={18} />
            </button>
            {inner}
          </aside>
        </div>
      )}
    </>
  );
}
