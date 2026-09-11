import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { MetricRow } from '@/components/ui/metric-card';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading placeholders.
 *
 * ONE loading vocabulary for the whole app. The most-cited loading mistake is
 * not "no spinner" — it is a product where one screen spins, the next shows
 * skeletons and a third dims behind an overlay, so the reader never learns what
 * "busy" looks like and reads every one of them as a possible failure.
 *
 * The rule here: anything that occupies LAYOUT while it loads gets a skeleton
 * shaped like the thing that is coming; anything that is a discrete action gets
 * the `Spinner` (a button, a validate step). Never both in one place.
 *
 * A skeleton must MATCH the real layout. A generic grey block that resolves
 * into something a different size makes the page jump, which is worse than
 * showing nothing — that is why the presets below are built from the same
 * `MetricRow` / `Card` primitives as the real screens rather than from
 * free-floating rectangles.
 *
 * `ds-shimmer` respects `prefers-reduced-motion` via the global reduce block.
 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('ds-shimmer rounded-[var(--r-sm)] bg-surface-2', className)}
      {...rest}
    />
  );
}

/** A skeleton in the shape of the status row. */
function SkeletonMetricRow({ count = 4 }: { count?: number }) {
  return (
    <MetricRow className="shrink-0">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-[var(--r-md)] border border-line bg-surface px-4 py-3.5"
        >
          <Skeleton className="h-3 w-20" />
          {/* Matches `.t-stat`'s rendered height, so the row does not resize
              when the real numbers land. */}
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </MetricRow>
  );
}

/** A skeleton in the shape of a titled panel with a chart or list inside. */
function SkeletonPanel({ lines = 5, className }: { lines?: number; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-4">
              <Skeleton className="h-3.5" style={{ width: `${38 + ((i * 13) % 30)}%` }} />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * The standard page-loading shape: a status row over a stacked panel column.
 * Route `loading.tsx` files render this so every route's busy state is the same
 * shape as every other route's.
 */
export function SkeletonPage({ metrics = 4, panels = 2 }: { metrics?: number; panels?: number }) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4" role="status" aria-label="Loading">
      <SkeletonMetricRow count={metrics} />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
          {Array.from({ length: panels }, (_, i) => (
            <SkeletonPanel key={i} lines={i === 0 ? 6 : 4} />
          ))}
        </div>
        <SkeletonPanel lines={4} />
      </div>
    </div>
  );
}
