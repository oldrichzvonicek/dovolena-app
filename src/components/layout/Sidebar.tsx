"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useFeatures } from "@/lib/use-features";
import type { FeatureKey } from "@/lib/plans";
import { FEATURE_LABELS } from "@/lib/plans";
import { unlockHint } from "@/components/shared/FeatureGate";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardList, Clock, Users, BarChart3, Sparkles, Download, Settings, HelpCircle, LogOut, X, ChevronDown, Users2, Building2, Landmark, Tags, SlidersHorizontal, CreditCard, History, Plug, Mail, Lock, Wallet, CalendarOff, ShieldCheck, Inbox, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useOnDataChanged } from "@/lib/events";
import { fetchDecisionScope } from "@/lib/approval-scope";
import { allowedSettingsSections, canSeeAnalytics, canSeeInsights, canSeeReports, canSeeSettings, isHr } from "@/lib/access";
import { AppLockup } from "@/components/shared/AppLockup";
import { Avatar } from "@/components/ui/avatar";

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
// Dřív "Kalendář a provoz" samo o sobě bylo 6 záložek na jedné stránce — rozdělené podle toho, na co se admin
// ptá (kdo tu je a kdo koho schvaluje / na co mají lidé nárok / kdo co vidí / kolik platíme / co se stalo),
// ne podle toho, jak nastavení vzniklo v kódu. Viz UX audit Nastavení firmy.
const settingsGroups = [
  {
    title: "Organizace",
    items: [
      { key: "profile", label: "Firma", icon: Landmark },
      { key: "users", label: "Lidé", icon: Users2 },
      { key: "departments", label: "Oddělení a schvalování", icon: Building2 },
    ],
  },
  {
    title: "Absence",
    items: [
      { key: "leave-types", label: "Typy absencí", icon: Tags },
      { key: "naroky", label: "Nároky a zůstatky", icon: Wallet },
      { key: "pravidla", label: "Pravidla žádostí", icon: CalendarOff },
      { key: "kalendar", label: "Pracovní kalendář", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Komunikace",
    items: [
      { key: "emails", label: "Notifikace", icon: Mail },
      { key: "integrations", label: "Integrace", icon: Plug, feature: "chat_integrations" as FeatureKey },
    ],
  },
  {
    title: "Bezpečnost a soukromí",
    items: [{ key: "bezpecnost", label: "Bezpečnost a soukromí", icon: ShieldCheck }],
  },
  {
    title: "Předplatné",
    items: [{ key: "billing", label: "Tarif a fakturace", icon: CreditCard }],
  },
  {
    title: "Záznamy",
    items: [
      { key: "audit", label: "Historie změn", icon: History, feature: "audit_log" as FeatureKey },
      { key: "zaznamy-emaily", label: "Doručení e-mailů", icon: Inbox },
    ],
  },
];

/** Zamčená položka menu: klik místo navigace na prázdnou zamčenou stránku otevře rovnou vysvětlení + odkaz na tarify. */
function LockedNavPopover({ label, feature }: { label: string; feature?: FeatureKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded py-2 pl-3 pr-3 text-sm text-ink transition-colors hover:bg-paper"
      >
        <span className="flex items-center gap-2.5">
          <Lock size={14} strokeWidth={2} className="text-muted" />
          {label}
        </span>
      </button>
      {open && feature && (
        <div role="dialog" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border border-line bg-white p-3 text-left shadow-[0_8px_30px_rgba(22,35,59,0.16)]">
          <div className="text-sm font-medium">{FEATURE_LABELS[feature]}</div>
          <p className="mt-1 text-xs text-muted">{unlockHint(feature)}</p>
          <Link
            href="/admin/settings?sekce=billing"
            onClick={() => setOpen(false)}
            className="mt-2 inline-block text-xs font-medium text-teal-dark underline underline-offset-2"
          >
            Zobrazit tarify a doplňky
          </Link>
        </div>
      )}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  badge,
  active,
  tourId,
  indent,
  locked,
  feature,
  trailing,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  active: boolean;
  tourId?: string;
  indent?: boolean;
  /** Funkce není v tarifu — místo odkazu na prázdnou zamčenou stránku rovnou vysvětlí, co odemkne (viz LockedNavPopover). */
  locked?: boolean;
  feature?: FeatureKey;
  /** Doplněk na konci řádku (např. odznáček klávesové zkratky). */
  trailing?: React.ReactNode;
}) {
  if (locked) return <LockedNavPopover label={label} feature={feature} />;
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

  // Escape-to-close is handled by Radix Dialog itself once open.
  useEffect(() => {
    const toggle = () => setMobileOpen((v) => !v);
    window.addEventListener(TOGGLE_NAV_EVENT, toggle);
    return () => window.removeEventListener(TOGGLE_NAV_EVENT, toggle);
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
          <AppLockup className="h-8 w-auto" />
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
              {adminNav
                .filter((item) => item.href !== "/admin/insights" || canSeeInsights(profile))
                .filter((item) => item.href !== "/admin/overview" || canSeeAnalytics(profile))
                .map((item) => (
                <NavLink key={item.href} {...item} active={pathname === item.href} locked={isLocked((item as { feature?: FeatureKey }).feature)} />
              ))}
              {/* HR vidí Zaměstnance i mimo sekci Manažer (nemá Ke schválení, tam se neschvaluje) — smí za celou firmu, viz fetchDecisionScope. */}
              {!isManager && isHr(profile) && <NavLink href="/team" label="Zaměstnanci" icon={Users} active={pathname === "/team"} />}
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
              <div id="sidebar-settings" className="ml-[22px] mt-0.5 space-y-2 border-l-2 border-line pl-2">
                {isAdmin && (
                  <div className="space-y-0.5">
                    <NavLink href="/admin/settings?sekce=prehled" label="Přehled" icon={ListChecks} indent active={settingsSection === "prehled"} />
                  </div>
                )}
                {settingsGroups.map((g) => {
                  const items = g.items.filter((i) => allowedSettingsSections(profile).includes(i.key));
                  if (items.length === 0) return null;
                  // HR má jen pár položek napříč skupinami — nadpisy skupin by byly skoro samé jednořádkové
                  // skupiny, víc šumu než pomoci. Admin vidí plnou strukturu.
                  const showGroupTitle = isAdmin;
                  return (
                    <div key={g.title}>
                      {showGroupTitle && <div className="px-3 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted/70">{g.title}</div>}
                      <div className="space-y-0.5">
                        {items.map((i) => (
                          <NavLink
                            key={i.key}
                            href={`/admin/settings?sekce=${i.key}`}
                            label={i.label}
                            icon={i.icon}
                            indent
                            active={settingsSection === i.key}
                            tourId={i.key === "users" ? "nav-admin-settings" : undefined}
                            locked={isLocked((i as { feature?: FeatureKey }).feature)}
                            feature={(i as { feature?: FeatureKey }).feature}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
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
        <Avatar url={profile.avatar_url} initials={profile.avatar_initials} name={profile.name} className="h-8 w-8 shrink-0 bg-teal-light text-xs font-medium text-teal-dark" />
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
        Poháněno aplikací <AppLockup className="h-4 w-auto" />
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-white lg:flex">{inner}</aside>
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-ink/40 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-[60] flex h-full w-[280px] max-w-[85vw] flex-col bg-surface shadow-xl lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigace</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Zavřít menu" className="absolute right-2 top-2 rounded p-2 text-muted hover:bg-paper hover:text-ink">
              <X size={18} />
            </DialogPrimitive.Close>
            {inner}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
