"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { colorIcon, guides, type GuideAudience } from "@/lib/help-content";
import { cn } from "@/lib/utils";

const LABELS: Record<GuideAudience, string> = {
  employee: "Zaměstnanec",
  manager: "Manažer",
  admin: "Admin",
  hr: "HR",
  accountant: "Účetní",
};

/** Vlastní role + doplňková role (pokud ji má) jako první v pořadí, ať si je viditel najde hned. */
function orderFor(role: GuideAudience | undefined, staffRole: GuideAudience | undefined): GuideAudience[] {
  const order: GuideAudience[] = ["employee", "manager", "admin", "hr", "accountant"];
  const mine = [role, staffRole].filter((x): x is GuideAudience => !!x);
  return [...mine, ...order.filter((a) => !mine.includes(a))];
}

export default function GuidesPage() {
  const { profile } = useAuth();
  const staffRole = (profile?.staff_role as GuideAudience | null) ?? undefined;
  const order = orderFor(profile?.role as GuideAudience | undefined, staffRole);
  const [audience, setAudience] = useState<GuideAudience>(order[0] ?? "employee");

  useEffect(() => {
    setAudience(order[0] ?? "employee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role, profile?.staff_role]);

  const guide = guides.find((g) => g.audience === audience) ?? guides[0];
  const Icon = guide.icon;

  return (
    <div>
      <Header title="Návody podle role" subtitle="Co si projít jako první, než se do Dodia pustíte naplno" />
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
        <Link href="/help" className="flex items-center gap-1.5 text-sm text-teal-dark hover:underline">
          <ArrowLeft size={15} /> Zpět do Centra nápovědy
        </Link>

        <SegmentedControl
          ariaLabel="Zobrazit návod pro roli"
          value={audience}
          onChange={setAudience}
          activeClassName="border-teal-dark bg-teal-dark text-white"
          inactiveClassName="border-line bg-white text-ink hover:border-teal/40 hover:text-teal-dark"
          options={order.map((a) => ({ key: a, label: LABELS[a] }))}
        />

        <div className="card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", colorIcon[guide.color])}>
              <Icon size={18} />
            </div>
            <h2 className="font-display text-h1">{guide.title}</h2>
          </div>
          <p className="mt-3 text-sm text-muted">{guide.intro}</p>

          <ol className="mt-5 space-y-4">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-light text-xs font-medium text-teal-dark">{i + 1}</span>
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <p className="mt-0.5 text-sm text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="card flex items-start gap-3 p-4 text-sm">
          <Check size={16} className="mt-0.5 shrink-0 text-teal-dark" />
          <span>
            Tohle je jen rychlý start — podrobnosti ke každému kroku najdete v{" "}
            <Link href="/help" className="font-medium text-teal-dark hover:underline">
              Centru nápovědy
            </Link>
            .
          </span>
        </div>
      </div>
    </div>
  );
}
