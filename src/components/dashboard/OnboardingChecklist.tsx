"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Rocket, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { useOnDataChanged } from "@/lib/events";
import { cn } from "@/lib/utils";
import { CHAT_INTEGRATIONS_ENABLED } from "@/lib/plans";

interface Step {
  key: string;
  title: string;
  hint: string;
  href: string;
  cta: string;
  done: boolean;
  optional?: boolean;
}

const seenKey = (companyId: string) => `dodio:onboarding-seen:${companyId}`;
const hiddenKey = (companyId: string) => `dodio:onboarding-hidden:${companyId}`;

function readSeen(companyId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(seenKey(companyId)) ?? "[]");
  } catch {
    return [];
  }
}

/** Admin-only "Začínáme" checklist. Progress is derived from real data, so it can never get out of sync. */
export function OnboardingChecklist() {
  const { profile } = useAuth();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [hidden, setHidden] = useState(true);
  const [tick, setTick] = useState(0);

  useOnDataChanged(() => setTick((t) => t + 1));

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    try {
      setHidden(localStorage.getItem(hiddenKey(profile.company_id)) === "1");
    } catch {
      setHidden(false);
    }
    const supabase = createClient();
    const cid = profile.company_id;
    let cancelled = false;
    (async () => {
      const [company, billing, depts, people, invites, hooks, deptRows, staff] = await Promise.all([
        supabase.from("companies").select("logo_url").eq("id", cid).single(),
        supabase.from("company_billing").select("billing_ico").eq("company_id", cid).maybeSingle(),
        supabase.from("departments").select("id", { count: "exact", head: true }).eq("company_id", cid),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("active", true),
        supabase.from("company_invites").select("id", { count: "exact", head: true }).eq("company_id", cid),
        supabase.from("webhook_integrations").select("id", { count: "exact", head: true }).eq("company_id", cid),
        supabase.from("departments").select("id, head_profile_id, deputy_head_profile_id").eq("company_id", cid),
        supabase.from("profiles").select("id, role, manager_id, department_id").eq("company_id", cid).eq("active", true),
      ]);
      // People whose requests only an admin can approve: no manager and no head / deputy of their department.
      const noApprover = ((staff.data ?? []) as { id: string; role: string; manager_id: string | null; department_id: string | null }[]).filter((p) => {
        if (p.role === "admin" || p.manager_id) return false;
        const d = ((deptRows.data ?? []) as { id: string; head_profile_id: string | null; deputy_head_profile_id: string | null }[]).find((x) => x.id === p.department_id);
        return !d || (!d.head_profile_id && !d.deputy_head_profile_id);
      }).length;
      const nonAdmins = ((staff.data ?? []) as { role: string }[]).filter((p) => p.role !== "admin").length;
      if (cancelled) return;
      const seen = readSeen(cid);
      setSteps([
        {
          key: "company",
          title: "Doplňte údaje o firmě",
          hint: "Logo a fakturační údaje (lze načíst z ARES podle IČO).",
          href: "/admin/settings?sekce=general",
          cta: "Nastavit",
          done: !!company.data?.logo_url || !!billing.data?.billing_ico,
        },
        {
          key: "departments",
          title: "Vytvořte oddělení",
          hint: "Podle nich se hlídá kapacita a řadí kalendář.",
          href: "/admin/settings?sekce=departments",
          cta: "Přidat oddělení",
          done: (depts.count ?? 0) > 0,
        },
        {
          key: "people",
          title: "Pozvěte kolegy",
          hint: "Vložte e-maily najednou, pošlete odkaz nebo nahrajte CSV.",
          href: "/admin/settings?sekce=users",
          cta: "Pozvat lidi",
          done: (people.count ?? 0) > 1 || (invites.count ?? 0) > 0,
        },
        {
          key: "approvers",
          title: "Určete, kdo schvaluje žádosti",
          hint: noApprover > 0 ? `${noApprover} ${noApprover === 1 ? "člověk nemá" : "lidí nemá"} nadřízeného ani vedoucího oddělení — jejich žádosti schválí jen admin.` : "Každému nastavte nadřízeného, nebo oddělení určete vedoucího.",
          href: "/admin/settings?sekce=users",
          cta: "Přiřadit",
          done: nonAdmins > 0 && noApprover === 0,
        },
        {
          key: "rules",
          title: "Zkontrolujte typy absencí a pravidla",
          hint: "Nároky na dovolenou, předstih žádostí, převod do dalšího roku.",
          href: "/admin/settings?sekce=leave-types",
          cta: "Projít pravidla",
          done: seen.includes("rules"),
        },
        ...(CHAT_INTEGRATIONS_ENABLED
          ? [
              {
                key: "chat",
                title: "Propojte chat (Slack, Teams…)",
                hint: "Nové žádosti a ranní přehled přímo v kanálu.",
                href: "/admin/settings?sekce=integrations",
                cta: "Propojit",
                done: (hooks.count ?? 0) > 0 || seen.includes("chat"),
                optional: true,
              },
            ]
          : []),
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, tick]);

  if (!profile || profile.role !== "admin" || !steps || hidden) return null;

  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  const allDone = doneCount === required.length;
  const pct = Math.round((doneCount / required.length) * 100);

  function markSeen(key: string) {
    if (!profile) return;
    try {
      const seen = readSeen(profile.company_id);
      if (!seen.includes(key)) localStorage.setItem(seenKey(profile.company_id), JSON.stringify([...seen, key]));
    } catch {
      /* private mode — progress for this step just isn't remembered */
    }
  }

  function hide() {
    if (!profile) return;
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(profile.company_id), "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <section aria-label="Začínáme s Dodiem" className="card overflow-hidden">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <Rocket size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-h2">{allDone ? "Dodio je připravené 🎉" : "Začínáme s Dodiem"}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {allDone ? "Všechny základní kroky jsou hotové. Tuto kartu můžete skrýt." : `Ještě pár kroků a vaši lidé mohou žádat o absence. Hotovo ${doneCount} ze ${required.length}.`}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Průběh nastavení">
            <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={hide} aria-label="Skrýt kartu Začínáme" title="Skrýt" className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink">
          <X size={16} />
        </button>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              onClick={() => {
                if (s.key === "rules" || s.key === "chat") markSeen(s.key);
              }}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-paper"
            >
              <span
                aria-hidden
                className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", s.done ? "border-teal bg-teal text-white" : "border-line bg-white text-transparent")}
              >
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-medium", s.done && "text-muted line-through")}>
                  {s.title}
                  {s.optional && <span className="ml-2 rounded-full bg-paper px-2 py-0.5 text-[11px] font-normal text-muted no-underline ring-1 ring-line">volitelné</span>}
                </span>
                {!s.done && <span className="block text-xs text-muted">{s.hint}</span>}
              </span>
              {!s.done && (
                <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-teal-dark">
                  {s.cta} <ChevronRight size={14} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
