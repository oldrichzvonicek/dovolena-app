import { cn } from "@/lib/utils";
import { LeaveColor, RequestStatus } from "@/lib/supabase/types";
import { leaveIconFor, LeaveTypeIcon } from "@/components/shared/LeaveTypeIcon";

// Text on a tinted background always pairs with that family's "-dark" shade
// (Dodio brand rule) — never the bare DEFAULT color on its own light tint.
const colorClasses: Record<LeaveColor, string> = {
  teal: "bg-teal-light text-teal-dark",
  rust: "bg-rust-light text-rust-dark",
  moss: "bg-moss-light text-moss-dark",
  violet: "bg-violet-light text-violet-dark",
  amber: "bg-amber-light text-amber-dark",
  sky: "bg-sky-light text-sky-dark",
  plum: "bg-plum-light text-plum-dark",
  sage: "bg-sage-light text-sage-dark",
  gold: "bg-gold-light text-gold-dark",
  wine: "bg-wine-light text-wine-dark",
  slate: "bg-slate-light text-slate-dark",
  forest: "bg-forest-light text-forest-dark",
};

/** Leave-type chip — tinted background in the type's own color, plus its
 * design-system icon when the type key has one (falls back to a plain dot
 * for company-custom types the icon set doesn't cover). */
export function LeaveBadge({
  type,
  className,
}: {
  type: { key?: string; label: string; color: LeaveColor };
  className?: string;
}) {
  const icon = type.key ? leaveIconFor(type.key) : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        colorClasses[type.color],
        className
      )}
    >
      {icon ? <LeaveTypeIcon name={icon} size={12} /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {type.label}
    </span>
  );
}

// Request-status Badge, per the Dodio design system: always a dot + short
// label, dark text on a tinted background — never color alone, never a
// solid-fill pill.
const statusMeta: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Čeká na schválení", className: "bg-warning-light text-warning-dark" },
  approved: { label: "Schváleno", className: "bg-teal-light text-teal-dark" },
  rejected: { label: "Zamítnuto", className: "bg-danger-light text-danger-dark" },
};

export function StatusBadge({
  status,
  className,
  title,
}: {
  status: RequestStatus;
  className?: string;
  title?: string;
}) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium", meta.className, className)}
      title={title}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
