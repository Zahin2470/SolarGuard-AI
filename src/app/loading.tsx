import { Skeleton } from "@/components/ui/States";

/** Skeleton shaped like the Fleet Overview: header, KPI row, chart + cases, table. */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading fleet overview">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Skeleton className="h-[440px] xl:col-span-7" />
        <Skeleton className="h-[440px] xl:col-span-5" />
      </div>
      <Skeleton className="h-72" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
