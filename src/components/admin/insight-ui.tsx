"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Sdílené stavební prvky karet Smart HR. */
export function Card({ icon, title, hint, children, className }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-center gap-2 font-display text-h2">
        {icon} {title}
      </div>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

/**
 * Jednotný „semafor“: červený odznak = řešit hned (lidé v minusu, zamítání nad 10 %, kapacitní problém),
 * oranžový = pozor (pomalé schvalování, propadající dovolená). Bez tónu je hodnota jen šedý text.
 */
export type Tone = "danger" | "warning";
export const TONE_BADGE: Record<Tone, string> = { danger: "bg-danger-light text-danger-dark", warning: "bg-warning-light text-warning-dark" };

export const Row = ({ left, right, tone }: { left: string; right: string; tone?: Tone }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-0">
    <span className="min-w-0 truncate">{left}</span>
    {tone ? <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", TONE_BADGE[tone])}>{right}</span> : <span className="shrink-0 text-muted">{right}</span>}
  </div>
);

export const Empty = ({ text }: { text: string }) => <p className="text-muted">✓ {text}</p>;

export interface BarItem {
  label: string;
  value: number;
  /** Budoucí (ještě nenastalé) období se kreslí světleji. */
  muted?: boolean;
  /** Lidé, kterých se sloupec týká; ukážou se v tooltipu při najetí. */
  ids?: string[];
}

/**
 * Sloupcový graf s osou Y (maximum a polovina), vodorovnými čarami a tooltipem: při najetí myší ukáže přesnou hodnotu
 * a jména lidí, kterých se sloupec týká. Na dotykových displejích funguje klepnutím.
 */
export function Bars({ items, unit = "", axisUnit, nameOf, limit = 12, highlight }: { items: BarItem[]; unit?: string; axisUnit?: string; nameOf?: (id: string) => string; limit?: number; highlight?: (v: number) => boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const top = Math.ceil(max);
  const axis = axisUnit ?? unit.trim();
  const cur = active !== null ? items[active] : null;
  const names = cur?.ids && nameOf ? cur.ids.map(nameOf).sort((a, b) => a.localeCompare(b, "cs")) : [];
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex h-24 w-9 shrink-0 flex-col justify-between text-right text-[10px] leading-none text-muted" aria-hidden="true">
          <span>{top}</span>
          <span>{Math.round((top / 2) * 10) / 10}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative flex h-24 items-end gap-1.5 border-b border-line" onMouseLeave={() => setActive(null)}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
            {items.map((i, idx) => (
              <button
                key={i.label}
                type="button"
                onMouseEnter={() => setActive(idx)}
                onFocus={() => setActive(idx)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(active === idx ? null : idx)}
                aria-label={`${i.label}: ${i.value}${unit}`}
                className="relative flex h-full flex-1 items-end outline-none"
              >
                <span
                  className={cn("block w-full rounded-t", highlight?.(i.value) ? "bg-warning/70" : i.muted ? "bg-teal/30" : "bg-teal/70", active === idx && "ring-2 ring-ink/40")}
                  style={{ height: `${Math.max(i.value > 0 ? 3 : 0, (i.value / top) * 100)}%` }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {items.map((i) => (
              <span key={i.label} className="flex-1 text-center text-[10px] text-muted">
                {i.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {axis && <p className="mt-1 pl-11 text-[10px] text-muted">Osa Y: {axis}</p>}
      {cur && (
        <div className="pointer-events-none absolute left-11 top-0 z-20 max-w-[260px] rounded-lg border border-line bg-white p-2.5 text-xs shadow-[0_8px_30px_rgba(22,35,59,0.16)]" role="tooltip">
          <div className="font-medium">
            {cur.label}: {cur.value}
            {unit}
          </div>
          {names.length > 0 && (
            <div className="mt-1 text-muted">
              {names.slice(0, limit).join(", ")}
              {names.length > limit && ` a dalších ${names.length - limit}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
