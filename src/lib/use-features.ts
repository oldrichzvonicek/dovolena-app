"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { hasFeature, planByKey, type FeatureKey, type Plan } from "@/lib/plans";

interface Entitlements {
  loading: boolean;
  plan: Plan;
  addons: string[];
  has: (feature: FeatureKey) => boolean;
}

/** Tarif a doplňky firmy přihlášeného uživatele; `has("hr_insights")` říká, jestli je funkce odemčená. */
export function useFeatures(): Entitlements {
  const { profile } = useAuth();
  const [state, setState] = useState<{ plan: string; addons: string[] } | null>(null);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      let { data } = await supabase.from("companies").select("plan, addons").eq("id", profile.company_id).single();
      // Sloupec addons vzniká až po spuštění aktualizovaného schema.sql — do té doby stačí samotný tarif.
      if (!data) data = (await supabase.from("companies").select("plan").eq("id", profile.company_id).single()).data as typeof data;
      if (alive) setState({ plan: (data?.plan as string) ?? "free", addons: (data?.addons as string[] | null) ?? [] });
    })();
    return () => {
      alive = false;
    };
  }, [profile]);

  const plan = planByKey(state?.plan);
  const addons = state?.addons ?? [];
  return { loading: state === null, plan, addons, has: (f) => hasFeature(plan.key, addons, f) };
}
