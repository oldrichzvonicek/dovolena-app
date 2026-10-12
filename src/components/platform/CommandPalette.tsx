"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Building2, CornerDownLeft, FileText, History, LayoutDashboard, Scale, Search, Tags, UserRoundCheck, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformFetch } from "./api";

interface CompanyHit {
  id: string;
  name: string;
  seq_id: number;
  matchedPerson?: string;
}

/** Statické zkratky na stránky — vždy nabídnuté, filtrují se podle dotazu stejně jako firmy. */
const PAGES = [
  { label: "Přehled", href: "/", icon: LayoutDashboard },
  { label: "Firmy", href: "/companies", icon: Building2 },
  { label: "Faktury", href: "/invoices", icon: FileText },
  { label: "Ceník", href: "/plans", icon: Tags },
  { label: "GDPR žádosti", href: "/gdpr", icon: UserRoundCheck },
  { label: "Právní dokumenty", href: "/legal", icon: Scale },
  { label: "Audit log", href: "/audit", icon: History },
  { label: "Admin tým", href: "/team", icon: Users2 },
];

/**
 * Cmd/Ctrl+K odkudkoli v adminu: hledání firmy podle názvu, čísla nebo e-mailu a jména jejího uživatele, plus rychlá
 * navigace na stránky. Firmy hledá /api/platform/search (jen id, název, číslo — žádná další data firmy).
 */
export function CommandPalette({ canSearchCompanies }: { canSearchCompanies: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [companies, setCompanies] = useState<CompanyHit[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCompanies([]);
      setActive(0);
      return;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !canSearchCompanies || q.trim().length < 2) {
      setCompanies([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      platformFetch<{ companies: CompanyHit[] }>(`/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setCompanies(r.companies))
        .catch(() => setCompanies([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open, canSearchCompanies]);

  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase()));
  const items: { key: string; label: string; sub?: string; href: string; icon: React.ElementType }[] = [
    ...pages.map((p) => ({ key: `page:${p.href}`, label: p.label, href: p.href, icon: p.icon })),
    ...companies.map((c) => ({ key: `company:${c.id}`, label: `${c.name} (#${c.seq_id})`, sub: c.matchedPerson ? `nalezeno přes ${c.matchedPerson}` : undefined, href: `/companies/${c.id}`, icon: Building2 })),
  ];

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded border border-line bg-paper px-3 py-2 text-left text-sm text-muted hover:bg-white dark:hover:bg-surface"
        aria-label="Hledat (Ctrl+K)"
      >
        <Search size={15} />
        <span className="flex-1">Hledat…</span>
        <kbd className="rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted dark:bg-surface">Ctrl K</kbd>
      </button>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-white shadow-[0_8px_30px_rgba(22,35,59,0.16)] dark:bg-surface"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              go(items[active].href);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Hledat</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Search size={16} className="text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              placeholder="Firma, e-mail uživatele nebo stránka…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
            {loading && <span className="text-caption text-muted">hledám…</span>}
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">{q.trim().length < 2 ? "Napište aspoň 2 znaky." : "Nic nenalezeno."}</li>
            ) : (
              items.map((it, i) => {
                const Icon = it.icon;
                return (
                  <li key={it.key}>
                    <button
                      onClick={() => go(it.href)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm", i === active ? "bg-teal-light text-teal-dark" : "text-ink")}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.sub && <span className="truncate text-caption text-muted">{it.sub}</span>}
                      {i === active && <CornerDownLeft size={13} className="shrink-0 text-muted" aria-hidden />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
