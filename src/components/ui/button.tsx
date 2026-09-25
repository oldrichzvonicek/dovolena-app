import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded px-5 py-2.5 max-sm:min-h-11 text-body-strong transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
