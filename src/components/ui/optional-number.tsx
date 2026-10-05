"use client";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

/** Číselný vstup s pevnou jednotkou vpravo (dní, hodin, %), ať je zřejmé, co číslo znamená. */
export function UnitInput({ unit, className, ...props }: { unit: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cn("inline-flex items-stretch overflow-hidden rounded border border-line bg-white focus-within:ring-2 focus-within:ring-teal/40", props.disabled && "opacity-60", className)}>
      <input type="number" {...props} className="w-16 bg-transparent px-2 py-1.5 text-right text-sm outline-none" />
      <span className="flex items-center border-l border-line bg-paper px-2 text-xs text-muted">{unit}</span>
    </span>
  );
}

/** Volitelná hodnota: přepínač Zapnuto/Vypnuto a vedle něj číslo s jednotkou (žádné „0 = vypnuto“). */
export function OptionalNumber({
  enabled,
  onToggle,
  value,
  onCommit,
  unit,
  offLabel,
  onLabel,
  disabled,
  min = 0,
  step = 1,
}: {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  value: number | null;
  onCommit: (n: number) => void;
  unit: string;
  offLabel: string;
  onLabel: string;
  disabled?: boolean;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Switch checked={enabled} onCheckedChange={onToggle} disabled={disabled} label={onLabel} />
      {enabled ? (
        <>
          <span className="text-sm">{onLabel}</span>
          <UnitInput unit={unit} min={min} step={step} disabled={disabled} defaultValue={value ?? ""} aria-label={onLabel} onBlur={(e) => e.target.value !== "" && onCommit(Number(e.target.value))} />
        </>
      ) : (
        <span className="text-sm text-muted">{offLabel}</span>
      )}
    </div>
  );
}
