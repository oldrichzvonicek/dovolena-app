import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** "sm" = compact toolbar/inline button (dřív ručně kopírovaný "rounded border px-3 py-1.5 text-xs"). Výchozí "md". */
  size?: Size;
}

// Dodio Button spec: primary uses teal-dark (not the lighter teal DEFAULT) —
// white text on DEFAULT fails 4.5:1 contrast, the dark shade passes. Ghost
// is a low-emphasis text link in teal-dark, never plain ink. Danger stays
// outlined, never a solid red fill (too aggressive at button size).
const variantClasses: Record<Variant, string> = {
  primary: "bg-teal-dark text-white hover:bg-teal-dark/90",
  secondary: "bg-white text-ink border border-line hover:bg-paper",
  ghost: "text-teal-dark hover:bg-paper",
  danger: "bg-white text-danger-dark border border-danger/40 hover:bg-danger-light",
};

const sizeClasses: Record<Size, string> = {
  md: "gap-2 rounded px-5 py-2.5 max-sm:min-h-11 text-body-strong",
  sm: "gap-1.5 rounded px-3 py-1.5 text-xs font-medium",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        // disabled:opacity-50 alone read as "just a bit muted, maybe still clickable" — grayscale + a
        // lower opacity + the not-allowed cursor make "you can't click this yet" unambiguous at a glance.
        "inline-flex items-center justify-center transition-colors disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
