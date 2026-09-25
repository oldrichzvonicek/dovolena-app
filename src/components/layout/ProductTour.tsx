"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { visibleTo, type HelpRole } from "@/lib/help-content";
import { Button } from "@/components/ui/button";

export const START_TOUR_EVENT = "dodio:start-tour";

interface Step {
  target: string;
  title: string;
  text: string;
  roles?: HelpRole[];
}

const steps: Step[] = [
  { target: "nav-dashboard", title: "Nástěnka", text: "Váš zůstatek dovolené, kapacita týmu a kdo dnes chybí — vše na jednom místě." },
  { target: "header-new-request", title: "Nová žádost", text: "Odsud zadáte žádost o absenci z kterékoli stránky." },
  { target: "nav-calendar", title: "Týmový kalendář", text: "Přehled absencí celého týmu. Na svém řádku můžete termín vybrat přetažením myší." },
  { target: "nav-requests", title: "Moje žádosti", text: "Historie vašich žádostí, jejich stavy a možnost upravit nebo zopakovat." },
  { target: "nav-approvals", title: "Ke schválení", text: "Žádosti čekající na vaše rozhodnutí — jde schvalovat i hromadně.", roles: ["manager", "admin"] },
  { target: "nav-team", title: "Můj tým", text: "Zůstatky lidí, zařazení do oddělení a upozornění na riziko vyhoření.", roles: ["manager", "admin"] },
  { target: "nav-admin-overview", title: "Analytika", text: "Firma na jeden pohled a nevyčerpaná dovolená ke konci roku.", roles: ["admin"] },
  { target: "nav-admin-settings", title: "Nastavení firmy", text: "Uživatelé, oddělení, typy absencí, provozní pravidla a fakturace.", roles: ["admin"] },
  { target: "header-notifications", title: "Notifikace", text: "Tady se dozvíte o schválení, zamítnutí i nových žádostech." },
  { target: "sidebar-cmdk", title: "Rychlá navigace", text: "Stiskněte Ctrl+K a přeskočte kamkoli v aplikaci." },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Spotlight walkthrough of the app shell. Started from anywhere via window.dispatchEvent(new Event(START_TOUR_EVENT)). */
export function ProductTour() {
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const available = useMemo(
    () => steps.filter((s) => visibleTo(profile?.role, s.roles)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.role, active]
  );
  const step = available[index];

  useEffect(() => {
    function start() {
      setIndex(0);
      setActive(true);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(false);
    }
    window.addEventListener(START_TOUR_EVENT, start);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(START_TOUR_EVENT, start);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useLayoutEffect(() => {
    if (!active || !step) return;
    function measure() {
      const el = Array.from(document.querySelectorAll(`[data-tour="${step.target}"]`)).find((n) => n.getBoundingClientRect().width > 0);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, step]);

  if (!active || !step) return null;

  const isLast = index === available.length - 1;
  const pad = 6;
  // Tooltip goes to the right of sidebar targets, below header targets, and stays inside the viewport.
  const tipStyle: React.CSSProperties = rect
    ? rect.left < 300
      ? { top: Math.max(12, Math.min(rect.top, window.innerHeight - 200)), left: rect.left + rect.width + 16 }
      : { top: rect.top + rect.height + 14, left: Math.max(12, Math.min(rect.left, window.innerWidth - 340)) }
    : { top: "40%", left: "calc(50% - 160px)" };

  return (
    <div className="fixed inset-0 z-[70]">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-teal shadow-[0_0_0_9999px_rgba(22,35,59,0.55)]"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink/55" />
      )}
      <div className="absolute w-80 rounded-lg border border-line bg-white p-4 shadow-[0_8px_30px_rgba(22,35,59,0.25)]" style={tipStyle}>
        <div className="text-[11px] uppercase tracking-wide text-muted">
          Krok {index + 1} z {available.length}
        </div>
        <div className="mt-1 font-display text-h2">{step.title}</div>
        <p className="mt-1.5 text-sm text-muted">{step.text}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setActive(false)} className="text-xs text-muted hover:text-ink">
            Přeskočit
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setIndex((i) => i - 1)}>
                Zpět
              </Button>
            )}
            <Button className="px-3 py-1.5 text-sm" onClick={() => (isLast ? setActive(false) : setIndex((i) => i + 1))}>
              {isLast ? "Hotovo" : "Další"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
