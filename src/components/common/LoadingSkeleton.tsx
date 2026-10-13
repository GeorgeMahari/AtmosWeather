import { Skeleton } from './primitives'

/** Placeholder with the same rough shape as the loaded dashboard. */
export function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid gap-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
        <div className="space-y-4">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="flex items-center gap-5 pt-3">
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-28 w-48" />
          </div>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-40 rounded-[1.25rem]" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[1.25rem]" />
        ))}
      </div>
      <Skeleton className="mt-10 h-80 rounded-[1.25rem]" />
    </div>
  )
}
