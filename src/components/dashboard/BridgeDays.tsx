"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarHeart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { loadBalances, remainingOf } from "@/lib/balances";
import { bridgeSuggestions, type BridgeSuggestion } from "@/lib/insights";
import { DEFAULT_WORK_DAYS, dayWord } from "@/lib/working-days";
import { reducesPresence } from "@/lib/leave-kinds";
import { RequestLeaveModal } from "@/components/dashboard/RequestLeaveModal";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

interface Tip extends BridgeSuggestion {
  teamAway: number;
  teamSize: number;
}

const fmt = (iso: string) => format(parseISO(iso), "EEE d. M.", { locale: cs });

/** "Chytré návrhy dovolené": kdy stačí 1–2 dny k souvislému volnu 4+ dní (svátky), s ohledem na vytížení týmu. */
export function BridgeDays({ onSaved }: { onSaved?: () => void }) {
  const { profile } = useAuth();
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pick, setPick] = useState<Tip | null>(null);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    const today = format(new Date(), "yyyy-MM-dd");
    const horizon = 200;

    (async () => {
      const [{ data: company }, balances, { data: mates }, { data: ownReqs }] = await Promise.all([
        supabase.from("companies").select("work_days").eq("id", profile.company_id).single(),
        loadBalances(profile.company_id, { profileId: profile.id }),
        profile.department_id
          ? supabase.from("profiles").select("id").eq("company_id", profile.company_id).eq("active", true).eq("department_id", profile.department_id)
          : Promise.resolve({ data: [] as { id: string }[] }),
        // Vlastní čekající i schválené žádosti: co už mám podané, se nemá nabízet znovu.
        supabase.from("leave_requests").select("start_date, end_date").eq("profile_id", profile.id).in("status", ["pending", "approved"]).gte("end_date", today),
      ]);
      const workDays = (company?.work_days as number[] | undefined) ?? DEFAULT_WORK_DAYS;
      const rem = remainingOf(balances.get(profile.id, "vacation"));
      setRemaining(rem);

      const mine = (ownReqs as { start_date: string; end_date: string }[] | null) ?? [];
      const suggestions = bridgeSuggestions(today, horizon, workDays, 2)
        .filter((s) => s.take.length <= Math.max(0, Math.floor(rem)))
        .filter((s) => !mine.some((r) => s.take.some((d) => d >= r.start_date && d <= r.end_date)));
      const team = (mates ?? []).map((m) => m.id as string);
      let away: { profile_id: string; start_date: string; end_date: string; leave_type: { key: string } | null }[] = [];
      if (team.length > 1 && suggestions.length > 0) {
        const { data } = await supabase
          .from("leave_requests")
          .select("profile_id, start_date, end_date, leave_type:leave_types(key)")
          .eq("status", "approved")
          .in("profile_id", team)
          .lte("start_date", format(addDays(new Date(), horizon + 14), "yyyy-MM-dd"))
          .gte("end_date", today);
        away = (data as unknown as typeof away) ?? [];
      }
      const withLoad = suggestions.map((s) => {
        let worst = 0;
        for (const d of s.take) {
          const n = new Set(away.filter((r) => r.profile_id !== profile.id && r.start_date <= d && r.end_date >= d && reducesPresence(r.leave_type?.key)).map((r) => r.profile_id)).size;
          worst = Math.max(worst, n);
        }
        return { ...s, teamAway: worst, teamSize: team.length };
      });
      // Pohodlnější (menší vytížení týmu) a výhodnější (víc volna za den) nahoře
      withLoad.sort((a, b) => a.teamAway / Math.max(1, a.teamSize) - b.teamAway / Math.max(1, b.teamSize) || b.offDays / b.take.length - a.offDays / a.take.length);
      setTips(withLoad.slice(0, 4));
    })().catch((e) => {
      console.error("BridgeDays failed:", e);
      setTips([]);
    });
  }, [profile]);

  if (!profile || !tips || tips.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 font-display text-h2">
        <CalendarHeart size={18} className="text-teal-dark" /> Chytré návrhy dovolené
      </div>
      <p className="mt-0.5 text-xs text-muted">
        S málem dní dovolené si prodloužíte volno kolem svátků. Zbývá vám {remaining !== null ? `${formatNumber(remaining)} ${dayWord(remaining)}` : "—"}.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {tips.map((t) => (
          <li key={t.take.join()} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                Vezměte si {t.take.length} {t.take.length === 1 ? "den" : "dny"} ({t.take.length === 1 ? fmt(t.take[0]) : `${fmt(t.take[0])} – ${fmt(t.take[t.take.length - 1])}`}) a budete mít{" "}
                <span className="text-teal-dark">{t.offDays} dní volna v kuse</span>
              </div>
              <div className="text-xs text-muted">
                {fmt(t.offStart)} – {fmt(t.offEnd)}
                {t.holiday ? ` · ${t.holiday}` : ""}
                {t.teamSize > 1 ? ` · v týmu bude chybět ${t.teamAway} z ${t.teamSize - 1}` : ""}
              </div>
            </div>
            <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setPick(t)}>
              Požádat
            </Button>
          </li>
        ))}
      </ul>
      {pick && (
        <RequestLeaveModal
          trigger={null}
          open={!!pick}
          onOpenChange={(o) => !o && setPick(null)}
          initialDates={{ start: pick.take[0], end: pick.take[pick.take.length - 1] }}
          onSaved={() => {
            // Podaný návrh hned zmizí (nečeká se na obnovení nástěnky).
            const done = pick;
            setTips((cur) => (cur ? cur.filter((t) => t.take.join() !== done.take.join()) : cur));
            setPick(null);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}
