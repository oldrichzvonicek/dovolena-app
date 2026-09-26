"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFeatures } from "@/lib/use-features";
import type { FeatureKey } from "@/lib/plans";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardList, Clock, Users, BarChart3, Sparkles, Download, Settings, HelpCircle, LogOut, X, ChevronDown, Users2, Building2, Tags, SlidersHorizontal, CreditCard, History, Plug, Mail, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useOnDataChanged } from "@/lib/events";
import { fetchDecisionScope } from "@/lib/approval-scope";
import { allowedSettingsSections, canSeeInsights, canSeeReports, canSeeSettings } from "@/lib/access";
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
  { href: "/admin/exports", label: "Exporty", icon: Download, feature: "exports" as FeatureKey },
  { href: "/admin/insights", label: "Smart HR", icon: Sparkles, feature: "hr_insights" as FeatureKey },
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
      { key: "integrations", label: "Integrace", icon: Plug, feature: "chat_integrations" as FeatureKey },
      { key: "emails", label: "E-maily", icon: Mail },
      { key: "audit", label: "Historie změn", icon: History, feature: "audit_log" as FeatureKey },
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
  locked,
  trailing,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  active: boolean;
  tourId?: string;
  indent?: boolean;
  /** Funkce není v tarifu — položka zůstane, ale ukáže zámek a stránka vysvětlí, co odemkne. */
  locked?: boolean;
  /** Doplněk na konci řádku (např. odznáček klávesové zkratky). */
  trailing?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-tour={tourId ?? `nav-${href.replace(/^\//, "").replace(/\//g, "-")}`}
      className={cn(
        "flex items-center justify-between rounded py-2 pr-3 text-sm transition-colors",
        "pl-3",
        active ? "bg-teal-light text-teal-dark font-medium" : "text-ink hover:bg-paper"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon size={17} strokeWidth={2} />
        {label}
      </span>
      {locked && <Lock size={12} className="text-muted" aria-label="Není v tarifu" />}
      {trailing}
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
  const features = useFeatures();
  const isLocked = (f?: FeatureKey) => !!f && !features.loading && !features.has(f);
  const [pendingCount, setPendingCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isManager = profile?.role === "manager" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  // Nastavení se po odchodu ze stránek nastavení samo sbalí a menu se vrátí nahoru.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (settingsSection === null) {
      setSettingsOpen(false);
      navRef.current?.scrollTo({ top: 0 });
    }
  }, [pathname, settingsSection]);

  function loadPending() {
    if (!isManager || !profile) return;
    const supabase = createClient();
    if (isAdmin) {
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .neq("profile_id", profile.id)
        .then(({ count }) => setPendingCount(count ?? 0));
      return;
    }
    // A manager's badge counts only the requests they may decide (their people).
    Promise.all([
      supabase.from("leave_requests").select("id, profile:profiles!leave_requests_profile_id_fkey(manager_id, department_id)").eq("status", "pending").neq("profile_id", profile.id),
      fetchDecisionScope(profile),
    ]).then(([{ data }, scope]) => {
      const rows = (data as unknown as { profile: { manager_id: string | null; department_id: string | null } | null }[]) ?? [];
      setPendingCount(rows.filter((r) => r.profile && scope.canDecide(r.profile)).length);
    });
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

      <nav ref={navRef} className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
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
              {[...managerNav, ...(!isAdmin && !canSeeReports(profile) ? [{ href: "/admin/overview", label: "Analytika", icon: BarChart3 }] : [])].map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  label={item.href === "/team" && isAdmin ? "Zaměstnanci" : item.label}
                  badge={item.href === "/approvals" ? pendingCount : undefined}
                  active={pathname === item.href}
                />
              ))}
            </div>
          </div>
        )}

        {(canSeeReports(profile) || canSeeSettings(profile)) && (
          <div>
            <div className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              {isAdmin ? "Administrace" : profile.staff_role === "hr" ? "HR" : "Mzdy"}
            </div>
            <div className="space-y-1">
              {adminNav.filter((item) => item.href !== "/admin/insights" || canSeeInsights(profile)).map((item) => (
                <NavLink key={item.href} {...item} active={pathname === item.href} locked={isLocked((item as { feature?: FeatureKey }).feature)} />
              ))}
            </div>
            {canSeeSettings(profile) && (
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen || settingsSection !== null}
              aria-controls="sidebar-settings"
              className="mt-1 flex w-full items-center justify-between rounded px-3 py-2 text-sm text-ink transition-colors hover:bg-paper"
            >
              <span className="flex items-center gap-2.5">
                <Settings size={17} strokeWidth={2} />
                {isAdmin ? "Nastavení firmy" : "Správa lidí"}
              </span>
              <ChevronDown size={15} className={cn("text-muted transition-transform", (settingsOpen || settingsSection !== null) && "rotate-180")} />
            </button>
            )}
            {canSeeSettings(profile) && (settingsOpen || settingsSection !== null) && (
              <div id="sidebar-settings" className="ml-[22px] mt-0.5 space-y-0.5 border-l-2 border-line pl-2">
                {settingsGroups
                  .flatMap((g) => g.items)
                  .filter((i) => allowedSettingsSections(profile).includes(i.key))
                  .map((i) => (
                    <NavLink
                      key={i.key}
                      href={`/admin/settings?sekce=${i.key}`}
                      label={i.label}
                      icon={i.icon}
                      indent
                      active={settingsSection === i.key}
                      tourId={i.key === "users" ? "nav-admin-settings" : undefined}
                      locked={isLocked((i as { feature?: FeatureKey }).feature)}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="px-3 pb-2">
        <NavLink
          href="/help"
          label="Nápověda"
          icon={HelpCircle}
          active={pathname === "/help"}
          trailing={
            <span data-tour="sidebar-cmdk" className="ml-auto rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] font-normal text-muted" title="Rychlá navigace: Ctrl + K">
              Ctrl K
            </span>
          }
        />
      </div>

      <div className="flex items-center gap-2.5 border-t border-line px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal-dark">
          {profile.avatar_initials}
        </div>
        <Link href="/account" className="min-w-0 flex-1 rounded outline-none hover:bg-paper focus-visible:ring-2 focus-visible:ring-teal" title="Můj účet: heslo, dvoufázové ověření, upozornění">
          <div className="truncate text-sm font-medium">{profile.name}</div>
          <div className="truncate text-xs text-muted">
            {profile.role === "admin" ? "Admin" : profile.role === "manager" ? "Manažer" : "Zaměstnanec"}
            {profile.staff_role === "hr" ? " · HR" : profile.staff_role === "accountant" ? " · Účetní" : ""} · Můj účet
          </div>
        </Link>
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
