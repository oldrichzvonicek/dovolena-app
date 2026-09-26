"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useFeatures } from "@/lib/use-features";
import { ADDONS, FEATURE_LABELS, formatKc, minPlanFor, type FeatureKey } from "@/lib/plans";
import { LoadingCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Kdo a jak funkci odemkne: doplněk (cena), nebo vyšší tarif. Text pro zamčené karty a štítky. */
export function unlockHint(feature: FeatureKey): string {
  const plan = minPlanFor(feature);
  const addon = ADDONS.find((a) => a.key === feature);
  const buy = addon && addon.availableOn.length > 0 ? ` Dá se i přikoupit za ${formatKc(addon.monthly)} měsíčně.` : "";
  return `Je od tarifu ${plan.name}.${buy}`;
}

/** Zamčená funkce: vysvětlí, co dělá, od jakého tarifu je a kam pro odemčení (admin) nebo koho požádat (ostatní). */
export function LockedFeature({ feature, description, className }: { feature: FeatureKey; description?: string; className?: string }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  return (
    <div className={cn("card border-dashed p-6", className)} role="status">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-muted">
          <Lock size={16} />
        </div>
        <div>
          <h2 className="font-display text-h2">{FEATURE_LABELS[feature]}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          <p className="mt-2 text-sm">{unlockHint(feature)}</p>
          <div className="mt-3 text-sm">
            {isAdmin ? (
              <Link href="/admin/settings?sekce=billing" className="font-medium text-teal-dark underline underline-offset-2">
                Zobrazit tarify a doplňky
              </Link>
            ) : (
              <span className="text-muted">Požádejte správce firmy, aby přešel na vyšší tarif.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Zobrazí obsah jen firmě, která funkci má; jinak zamčenou kartu. Během načítání tarifu nezobrazí nic (nebliká zámek). */
export function FeatureGate({ feature, description, children }: { feature: FeatureKey; description?: string; children: React.ReactNode }) {
  const f = useFeatures();
  if (f.loading) return <LoadingCard />;
  if (!f.has(feature)) return <LockedFeature feature={feature} description={description} />;
  return <>{children}</>;
}

/** Malý štítek u ovládacího prvku, který tarif nemá („od tarifu Pro“). */
export function PlanTag({ feature }: { feature: FeatureKey }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line" title={unlockHint(feature)}>
      <Lock size={10} /> od tarifu {minPlanFor(feature).name}
    </span>
  );
}
