"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, PlayCircle, Search, UserCog, UserRound, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { START_TOUR_EVENT } from "@/components/layout/ProductTour";
import { HelpFaqItem } from "@/components/shared/HelpFaqItem";
import { ContactSupportBox } from "@/components/shared/ContactSupportBox";
import { Button } from "@/components/ui/button";
import { colorIcon, faqs, sections, slug, type HelpFaq, type HelpRole, type HelpSection } from "@/lib/help-content";
import { cn } from "@/lib/utils";

const AUDIENCES: { key: HelpRole; label: string; icon: React.ElementType }[] = [
  { key: "employee", label: "Pro zaměstnance", icon: UserRound },
  { key: "manager", label: "Pro manažery", icon: Users },
  { key: "admin", label: "Pro administrátory", icon: UserCog },
];

/** Content tagged with roles is shown to that audience (admin sees everything); untagged content is for everyone. */
function forAudience(audience: HelpRole, roles?: HelpRole[]) {
  if (!roles) return true;
  if (audience === "admin") return true;
  if (audience === "manager") return roles.includes("manager");
  return false;
}

const HEADLINES_PER_CARD = 4;
const TOP_COUNT = 5;

export default function HelpPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<HelpRole>("employee");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // Start with the audience matching the viewer's own role.
  useEffect(() => {
    if (profile?.role) setAudience(profile.role);
  }, [profile?.role]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const audienceFaqs = useMemo(() => faqs.filter((f) => forAudience(audience, f.roles)), [audience]);
  const audienceSections = useMemo(() => sections.filter((s) => forAudience(audience, s.roles)), [audience]);

  const articlesOf = (s: HelpSection) => audienceFaqs.filter((f) => f.section === s.title);

  // Most-needed answers: the curated "top" ones first, topped up so there are always five.
  const topFaqs = useMemo(() => {
    const top = audienceFaqs.filter((f) => f.top);
    const rest = audienceFaqs.filter((f) => !f.top);
    return [...top, ...rest].slice(0, TOP_COUNT);
  }, [audienceFaqs]);

  const results = useMemo(() => {
    if (!searching) return { faqs: [] as HelpFaq[], items: [] as { section: HelpSection; text: string }[] };
    return {
      faqs: audienceFaqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
      items: audienceSections.flatMap((s) => s.items.filter((t) => t.toLowerCase().includes(q)).map((text) => ({ section: s, text }))),
    };
  }, [audienceFaqs, audienceSections, q, searching]);

  const section = activeSection ? audienceSections.find((s) => s.title === activeSection) ?? null : null;

  function openArticle(faq: HelpFaq) {
    setOpenFaq(faq.q);
    setActiveSection(faq.section);
    // The article lives inside the section detail — scroll to it once it has rendered.
    setTimeout(() => document.getElementById(`clanek-${slug(faq.q)}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  return (
    <div>
      <Header title="Centrum nápovědy" subtitle="Odpovědi na to, co se v Dodiu nejčastěji hledá" />
      <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-8">
        {/* Hero */}
        <div className="rounded-lg bg-teal-light/60 px-4 py-8 text-center sm:px-8 sm:py-10">
          <h2 className="font-display text-2xl sm:text-3xl">Jak vám můžeme pomoct?</h2>
          <div className="relative mx-auto mt-5 max-w-2xl">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveSection(null);
              }}
              placeholder="S čím potřebujete pomoct? (např. převod dovolené, fakturace…)"
              aria-label="Hledat v nápovědě"
              className="w-full rounded-lg border border-line bg-white py-3.5 pl-11 pr-4 text-base shadow-sm"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Zobrazit nápovědu pro">
            {AUDIENCES.map((a) => {
              const Icon = a.icon;
              const active = audience === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => {
                    setAudience(a.key);
                    setActiveSection(null);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
                    active ? "border-teal-dark bg-teal-dark text-white" : "border-line bg-white text-ink hover:border-teal/40 hover:text-teal-dark"
                  )}
                >
                  <Icon size={15} /> {a.label}
                </button>
              );
            })}
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}>
              <PlayCircle size={16} /> Spustit rychlého průvodce aplikací
            </Button>
          </div>
        </div>

        {/* Search results */}
        {searching && (
          <div>
            <p className="mb-3 text-sm text-muted">
              {results.faqs.length + results.items.length === 0
                ? "Nic jsme nenašli — zkuste jiné slovo nebo nám napište níže."
                : `Nalezeno ${results.faqs.length + results.items.length} výsledků pro „${query.trim()}“.`}
            </p>
            <div className="space-y-2">
              {results.faqs.map((f) => (
                <div key={f.q}>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{f.section}</div>
                  <HelpFaqItem faq={f} forceOpen />
                </div>
              ))}
              {results.items.map((r, i) => (
                <div key={i} className="card p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted">{r.section.title}</div>
                  <p className="mt-1 text-sm">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section detail */}
        {!searching && section && (
          <div>
            <button onClick={() => setActiveSection(null)} className="mb-4 flex items-center gap-1.5 text-sm text-teal-dark hover:underline">
              <ArrowLeft size={15} /> Zpět na přehled
            </button>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", colorIcon[section.color])}>
                <section.icon size={18} />
              </div>
              <h2 className="font-display text-h1">{section.title}</h2>
            </div>
            <div className="mt-5 space-y-2">
              {articlesOf(section).map((f) => (
                <div key={f.q} id={`clanek-${slug(f.q)}`} className="scroll-mt-24">
                  <HelpFaqItem key={`${f.q}-${openFaq === f.q}`} faq={f} forceOpen={openFaq === f.q} />
                </div>
              ))}
              {articlesOf(section).length === 0 && <p className="text-sm text-muted">Pro tuto sekci zatím nejsou žádné články.</p>}
            </div>
            <div className="card mt-6 p-5">
              <h3 className="font-display text-h2">Co v této části najdete</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-teal-dark">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Overview */}
        {!searching && !section && (
          <>
            <div>
              <h2 className="mb-3 text-label uppercase tracking-wide text-muted">Podle oblasti aplikace</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {audienceSections.map((s) => {
                  const Icon = s.icon;
                  const articles = articlesOf(s);
                  const shown = articles.slice(0, HEADLINES_PER_CARD);
                  return (
                    <div key={s.title} id={slug(s.title)} className="card flex flex-col p-5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", colorIcon[s.color])}>
                          <Icon size={15} />
                        </div>
                        <h3 className="font-display text-h2">{s.title}</h3>
                      </div>
                      <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                        {shown.map((f) => (
                          <li key={f.q}>
                            <button onClick={() => openArticle(f)} className="flex w-full gap-2 rounded text-left text-ink hover:text-teal-dark hover:underline">
                              <span className="text-teal-dark">•</span>
                              <span>{f.q}</span>
                            </button>
                          </li>
                        ))}
                        {shown.length === 0 && <li className="text-muted">Přehled možností této části.</li>}
                      </ul>
                      <button onClick={() => setActiveSection(s.title)} className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-dark hover:underline">
                        {articles.length > HEADLINES_PER_CARD ? `Zobrazit všech ${articles.length} článků` : "Zobrazit detail sekce"} <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div id="faq">
              <h2 className="mb-3 font-display text-h2">Nejčastější dotazy</h2>
              <div className="space-y-2">
                {topFaqs.map((f) => (
                  <HelpFaqItem key={f.q} faq={f} />
                ))}
              </div>
            </div>
          </>
        )}

        <ContactSupportBox />
      </div>
    </div>
  );
}
