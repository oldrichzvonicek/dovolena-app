import { cn } from "@/lib/utils";

/** Grey pulsing placeholder — keeps the layout stable while data loads (instead of a bare "Načítám…"). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded bg-line/50", className)} />;
}

/** Card-shaped loading state: a title bar plus a few rows. */
export function LoadingCard({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("card p-5", className)} role="status" aria-live="polite" aria-label="Načítám">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn("h-4", i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-5/6" : "w-2/3")} />
        ))}
      </div>
      <span className="sr-only">Načítám…</span>
    </div>
  );
}

/** Inline list placeholder for spots inside an existing card. */
export function LoadingLines({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label="Načítám" className="space-y-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i % 2 === 0 ? "w-full" : "w-4/5")} />
      ))}
      <span className="sr-only">Načítám…</span>
    </div>
  );
}
