import { LeaveColor } from "@/lib/supabase/types";

/** Solid background per leave color — for progress/share bars (chips use the "-light"/"-dark" pair in ui/badge.tsx instead). */
export const leaveColorBg: Record<LeaveColor, string> = {
  teal: "bg-teal",
  rust: "bg-rust",
  moss: "bg-moss",
  violet: "bg-violet",
  amber: "bg-amber",
  sky: "bg-sky",
  plum: "bg-plum",
  sage: "bg-sage",
  gold: "bg-gold",
  wine: "bg-wine",
  slate: "bg-slate",
  forest: "bg-forest",
};
