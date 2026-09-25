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
  Plus,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { allowedSettingsSections, canSeeAnalytics, canSeeReports } from "@/lib/access";
import { createClient } from "@/lib/supabase/client";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { cn } from "@/lib/utils";

interface Item {
  href?: string;
  /** Runs instead of navigating (e.g. opens the request form). */
  run?: () => void;
  hint?: string;
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
  { href: "/admin/overview", label: "Analytika", icon: BarChart3, group: "Administrace" },
  { href: "/admin/exports", label: "Exporty", icon: Download, group: "Administrace" },
  { href: "/admin/settings?sekce=users", label: "Nastavení firmy — Uživatelé", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=departments", label: "Nastavení firmy — Oddělení", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=leave-types", label: "Nastavení firmy — Typy absencí", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=general", label: "Nastavení firmy — Provoz & kalendář", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=billing", label: "Nastavení firmy — Fakturace & tarify", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=integrations", label: "Nastavení firmy — Integrace (Slack, Teams…)", icon: Settings, group: "Administrace" },
  { href: "/admin/settings?sekce=audit", label: "Nastavení firmy — Historie změn", icon: Settings, group: "Administrace" },
];
const helpItem: Item = { href: "/help", label: "Nápověda", icon: HelpCircle, group: "Navigace" };

/** Global Cmd+K / Ctrl+K quick navigation — mounted once in the app shell. */
export function CommandPalette() {
  const { profile } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [people, setPeople] = useState<{ id: string; name: string; department: string | null }[]>([]);
  const [types, setTypes] = useState<{ id: string; key: string; label: string }[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTypeId, setRequestTypeId] = useState<string | undefined>(undefined);

  // People and absence types are loaded lazily the first time the palette opens.
  useEffect(() => {
    if (!open || !profile || people.length > 0) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, name, department:departments!profiles_department_id_fkey(name)")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .then(({ data }) => setPeople(((data as unknown as { id: string; name: string; department: { name: string } | null }[]) ?? []).map((p) => ({ id: p.id, name: p.name, department: p.department?.name ?? null }))));
    supabase
      .from("leave_types")
      .select("id, key, label")
      .eq("company_id", profile.company_id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setTypes((data as { id: string; key: string; label: string }[]) ?? []));
  }, [open, profile, people.length]);

  const items = useMemo(() => {
    const isManager = profile?.role === "manager" || profile?.role === "admin";
    const isAdmin = profile?.role === "admin";
    const actions: Item[] = types.map((t) => ({
      label: `Nová žádost: ${t.label}`,
      icon: Plus,
      group: "Akce",
      run: () => {
        setRequestTypeId(t.id);
        setRequestOpen(true);
      },
    }));
    const allowed = allowedSettingsSections(profile);
    const staffItems = adminItems.filter((i) => {
      if (isAdmin) return true;
      if ((i.href ?? "").startsWith("/admin/settings")) return allowed.some((k) => (i.href ?? "").endsWith("=" + k));
      return (i.href ?? "").startsWith("/admin/overview") ? canSeeAnalytics(profile) : canSeeReports(profile);
    });
    return [...actions, ...mainItems, ...(isManager ? managerItems : []), ...staffItems, helpItem];
  }, [profile, types]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => !i.run || /(dovolen|home|sick|nemoc)/i.test(i.label)).slice(0, 12);
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const nq = norm(q);
    const base = items.filter((i) => norm(i.label).includes(nq));
    const ppl: Item[] =
      nq.length >= 2
        ? people
            .filter((p) => norm(p.name).includes(nq))
            .slice(0, 6)
            .map((p) => ({ href: `/calendar?hledat=${encodeURIComponent(p.name)}`, label: p.name, hint: p.department ?? undefined, icon: User, group: "Lidé" }))
        : [];
    return [...base, ...ppl];
  }, [items, query, people]);

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
    if (item.run) item.run();
    else if (item.href) router.push(item.href);
  }

  const requestModal = requestOpen ? (
    <RequestLeaveModal
      trigger={null}
      open={requestOpen}
      onOpenChange={setRequestOpen}
      prefill={requestTypeId ? { leave_type_id: requestTypeId } : undefined}
      onSaved={() => setRequestOpen(false)}
    />
  ) : null;

  if (!open) return requestModal;

  return (
    <>
    {requestModal}
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
            placeholder="Přejít na stránku, najít kolegu nebo zadat žádost…"
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
                key={`${item.href ?? "run"}-${item.label}`}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm",
                  i === activeIndex ? "bg-teal-light text-teal-dark" : "text-ink"
                )}
              >
                <Icon size={15} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="shrink-0 text-xs text-muted">{item.hint}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}
