import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/platform/ui";

export default function ViewLoading() {
  return (
    <div role="status" aria-live="polite" aria-label="Načítám" className="min-h-screen bg-paper">
      <Skeleton className="h-9 w-full" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </Card>
          ))}
        </div>
        <span className="sr-only">Načítám…</span>
      </div>
    </div>
  );
}
