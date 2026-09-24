import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Row, Stack } from '@/components/ui/layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Loading placeholders — one loading vocabulary for the whole app.
 *
 * Anything that occupies layout while it loads gets a skeleton shaped like the thing that is
 * coming; a discrete action (a button, a validate step) gets the `Spinner`. Never both in
 * one place.
 *
 * COUPLED: the presets below are built from the same `Row` / `Card` primitives as the real
 * screens, so a skeleton matches the layout it resolves into and the page does not jump.
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
    <Row split="1/4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-[var(--r-md)] border border-line bg-surface px-4 py-3.5"
        >
          <Skeleton className="h-3 w-20" />
          {/* COUPLED: matches `.t-stat`'s rendered height, so the row does not resize when
              the real numbers land. */}
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </Row>
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
 * The standard page-loading shape: the metric row, then a full-width panel over a `1/2` row,
 * which is the commonest page shape, so the swap to real content moves least.
 */
export function SkeletonPage({ metrics = 4 }: { metrics?: number }) {
  return (
    <Stack role="status" aria-label="Loading">
      <SkeletonMetricRow count={metrics} />
      <SkeletonPanel lines={6} />
      <Row split="1/2">
        <SkeletonPanel lines={4} />
        <SkeletonPanel lines={4} />
      </Row>
    </Stack>
  );
}
