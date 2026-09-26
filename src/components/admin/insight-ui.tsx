import { cn } from "@/lib/utils";

/** Sdílené stavební prvky karet Smart HR Insights. */
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

export const Row = ({ left, right, tone }: { left: string; right: string; tone?: "danger" | "warning" }) => (
  <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-0">
    <span className="min-w-0 truncate">{left}</span>
    <span className={tone === "danger" ? "shrink-0 font-medium text-danger-dark" : tone === "warning" ? "shrink-0 font-medium text-warning-dark" : "shrink-0 text-muted"}>{right}</span>
  </div>
);

export const Empty = ({ text }: { text: string }) => <p className="text-muted">✓ {text}</p>;
