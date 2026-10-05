import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/platform/ui";

/**
 * Suspense fallback pro každou stránku pod (shell) (Next.js ho použije při přechodu na kteroukoli vnořenou
 * trasu bez vlastního loading.tsx) — ať navigace nikdy nezůstane na okamžik úplně prázdná.
 */
export default function ShellLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Načítám">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded border border-line bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Card>
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </Card>
      </div>
      <span className="sr-only">Načítám…</span>
    </div>
  );
}
