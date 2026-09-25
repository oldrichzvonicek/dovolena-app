"use client";

import { useMemo, useState } from "react";
import { HelpCircle, PlayCircle, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { START_TOUR_EVENT } from "@/components/layout/ProductTour";
import { HelpFaqItem } from "@/components/shared/HelpFaqItem";
import { ContactSupportBox } from "@/components/shared/ContactSupportBox";
import { Button } from "@/components/ui/button";
import { colorIcon, faqsForRole, sectionsForRole, slug } from "@/lib/help-content";
import { cn } from "@/lib/utils";

// Cards respond to the CONTAINER's width (auto-fit/minmax), not the browser
// viewport — the app's own 260px sidebar already eats into the room.
const cardGrid = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]";

export default function HelpPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");

  const roleSections = useMemo(() => sectionsForRole(profile?.role), [profile?.role]);
  const roleFaqs = useMemo(() => faqsForRole(profile?.role), [profile?.role]);
  const searching = query.trim().length > 0;

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleSections;
    return roleSections
      .map((s) => ({ ...s, items: s.items.filter((item) => item.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [query, roleSections]);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleFaqs;
    return roleFaqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query, roleFaqs]);

  const hasResults = filteredFaqs.length > 0 || filteredSections.length > 0;
  const resultCount = filteredFaqs.length + filteredSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <Header title="Nápověda" subtitle="Odpovědi na časté otázky a přehled toho, co appka umí" />
      <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] max-w-md flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat v nápovědě…" aria-label="Hledat v nápovědě"
                className="w-full rounded border border-line bg-white py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <Button variant="secondary" onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}>
              <PlayCircle size={16} /> Spustit rychlého průvodce
            </Button>
          </div>
          {searching ? (
            <p className="mt-2 text-xs text-muted">
              {!hasResults ? "Nic jsme nenašli — zkuste jiné hledané slovo." : `Nalezeno ${resultCount} výsledků.`}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roleSections.map((s) => (
                <a
                  key={s.title}
                  href={`#${slug(s.title)}`}
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:border-teal/40 hover:text-teal-dark"
                >
                  {s.title}
                </a>
              ))}
            </div>
          )}
        </div>

        {filteredFaqs.length > 0 && (
          <div id="faq">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
                <HelpCircle size={15} />
              </div>
              <h2 className="font-display text-h2">Časté dotazy</h2>
            </div>
            <div className={cardGrid}>
              {filteredFaqs.map((f) => (
                <HelpFaqItem key={`${f.q}-${searching}`} faq={f} forceOpen={searching} />
              ))}
            </div>
          </div>
        )}

        {filteredSections.length > 0 && (
          <div>
            <h2 className="mb-3 text-label uppercase tracking-wide text-muted">Podle sekce aplikace</h2>
            <div className={cardGrid}>
              {filteredSections.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} id={slug(s.title)} className="card scroll-mt-8 p-5">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorIcon[s.color])}>
                        <Icon size={15} />
                      </div>
                      <h2 className="font-display text-h2">{s.title}</h2>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-muted">
                      {s.items.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-teal-dark">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <ContactSupportBox />
      </div>
    </div>
  );
}
