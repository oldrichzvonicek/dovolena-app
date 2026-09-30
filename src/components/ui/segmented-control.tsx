import { cn } from "@/lib/utils";

export interface SegmentedOption<T> {
  key: T;
  label: React.ReactNode;
  /** Přebije výchozí "border-ink bg-ink text-white" pro aktivní stav (např. barevné rychlé filtry). */
  activeClassName?: string;
}

/**
 * Sjednocená "pilulková" volba jedné možnosti ze skupiny (filtr, období, záložka sekce) — dřív ručně
 * kopírovaný `rounded-full border px-3 py-1 text-xs` na 15+ místech s drobně odlišnými rozměry a bez
 * konzistentní ARIA sémantiky. `as="tabs"` použij pro přepínání celé sekce stránky (role tablist/tab),
 * výchozí `as="group"` pro filtr/výběr, kde více voleb koncepčně nejsou "záložky".
 */
export function SegmentedControl<T>({
  options,
  value,
  onChange,
  ariaLabel,
  as = "group",
  size = "md",
  className,
  activeClassName,
  inactiveClassName,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  as?: "group" | "tabs";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Přebije výchozí aktivní/neaktivní barvy pro celou skupinu (např. tealová varianta na Nápovědě). */
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-sm" : size === "sm" ? "px-2.5 py-1 text-xs font-medium" : "px-3 py-1 text-xs font-medium";
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role={as === "tabs" ? "tablist" : "group"} aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={String(o.key)}
            type="button"
            role={as === "tabs" ? "tab" : undefined}
            aria-selected={as === "tabs" ? active : undefined}
            aria-pressed={as === "group" ? active : undefined}
            onClick={() => onChange(o.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border transition-colors",
              sizeClass,
              active ? (o.activeClassName ?? activeClassName ?? "border-ink bg-ink text-white") : (inactiveClassName ?? "border-line bg-white text-muted hover:bg-paper")
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
