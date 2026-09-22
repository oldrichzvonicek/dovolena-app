import { cn } from "@/lib/utils";
import { LeaveColor } from "@/lib/supabase/types";

const colorClasses: Record<LeaveColor, string> = {
  teal: "bg-teal-light text-teal",
  rust: "bg-rust-light text-rust",
  moss: "bg-moss-light text-moss",
  violet: "bg-violet-light text-violet",
  amber: "bg-amber-light text-amber",
};

export function LeaveBadge({
  type,
  className,
}: {
  type: { label: string; color: LeaveColor };
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium",
        colorClasses[type.color],
        className
      )}
    >
      {type.label}
    </span>
  );
}
