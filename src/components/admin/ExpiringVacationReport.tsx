"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { sendVacationReminders } from "@/lib/notifications";
import { loadBalances, remainingOf } from "@/lib/balances";
import { Button } from "@/components/ui/button";
import { cn, errorMessage, formatNumber } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  total: number;
  remaining: number;
}

/** Smart HR Insights — end-of-year report of people sitting on a large unused vacation balance, with a one-click bulk in-app reminder. */
const TOP = 8;

export function ExpiringVacationReport({ departmentId = "all" }: { departmentId?: string }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function load() {
    if (!profile) return;
    const supabase = createClient();

    const [{ data: employees }, balances] = await Promise.all([
      (departmentId === "all"
        ? supabase.from("profiles").select("id, name").eq("company_id", profile.company_id).eq("active", true)
        : supabase.from("profiles").select("id, name").eq("company_id", profile.company_id).eq("active", true).eq("department_id", departmentId)),
      loadBalances(profile.company_id),
    ]);

    const built = ((employees as unknown as { id: string; name: string }[]) ?? [])
      .map((e) => {
        const b = balances.get(e.id, "vacation");
        return { id: e.id, name: e.name, total: b.total, remaining: remainingOf(b) };
      })
      .filter((r) => r.total > 0 && r.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);

    setRows(built);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, departmentId]);

  if (profile?.role !== "admin" || rows === null || rows.length === 0) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows!.length ? new Set() : new Set(rows!.map((r) => r.id))));
  }

  async function handleSend() {
    if (selected.size === 0) return;
    setSending(true);
    setSentMessage(null);
    try {
      const n = await sendVacationReminders(Array.from(selected));
      setSentMessage({ text: `Úspěšně odesláno ${n} připomínek.`, error: false });
      setSelected(new Set());
    } catch (e) {
      setSentMessage({ text: `Nepodařilo se odeslat: ${errorMessage(e)}`, error: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div>
          <h2 className="font-display text-h2">Nevyčerpaná dovolená ke konci roku</h2>
          <p className="mt-0.5 text-xs text-muted">Lidé s velkou částí nároku, kterou letos ještě nevyčerpali.</p>
        </div>
        <Button variant="secondary" onClick={handleSend} disabled={selected.size === 0 || sending} className={profile?.role === "admin" || profile?.staff_role === "hr" ? "" : "hidden"}>
          <Send size={15} /> Odeslat výzvu k vyčerpání {selected.size > 0 && `(${selected.size})`}
        </Button>
      </div>
      {sentMessage && (
        <div
          className={cn(
            "border-b border-line px-5 py-2 text-sm",
            sentMessage.error ? "bg-danger-light text-danger-dark" : "bg-teal-light/30 text-teal-dark"
          )}
        >
          {sentMessage.text}
        </div>
      )}
      <div className={cn("divide-y divide-line", showAll && "max-h-[380px] overflow-y-auto")}>
        <div className="sticky top-0 z-10 flex items-center gap-3 bg-white px-5 py-1.5 text-xs uppercase tracking-wide text-muted">
          <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} className="h-3.5 w-3.5" />
          <span>Vybrat vše</span>
        </div>
        {(showAll ? rows : rows.slice(0, TOP)).map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 px-5 py-1.5 text-sm hover:bg-paper">
            <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-3.5 w-3.5" />
            <span className="flex-1 font-medium">{r.name}</span>
            <span className="text-muted">
              zbývá {formatNumber(r.remaining)} z {formatNumber(r.total)} dní
            </span>
          </label>
        ))}
      </div>
      {rows.length > TOP && (
        <button onClick={() => setShowAll((v) => !v)} className="w-full border-t border-line py-2 text-sm font-medium text-teal-dark hover:bg-paper">
          {showAll ? "Zobrazit méně" : `Zobrazit všech ${rows.length} zaměstnanců`}
        </button>
      )}
    </div>
  );
}
