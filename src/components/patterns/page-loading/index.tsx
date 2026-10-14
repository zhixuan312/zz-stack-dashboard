import type { ReactNode } from 'react';
import { PageFrame, Row, Stack, type PageWidth } from '../../base/shell/index';
import { Card } from '../../ui/card/index';
import { Skeleton } from '../../ui/skeleton/index';

/**
 * The frame every console route's loading state shares: one masthead skeleton, then the page's own body, announced once
 * as busy under the page's name. Each route's `loading.tsx` composes its body from these rows, in the shape of its page.
 * The title is the page's own heading, so the shell is acknowledged the moment this state commits; a detail page whose
 * title depends on the record leaves it out and keeps a skeleton. `width` follows the page it stands in for: a
 * skeleton at another width would move the content when the page arrives.
 */
export function LoadingPage({ name, title, width, children }: { name: string; title?: string; width?: PageWidth; children: ReactNode }) {
  return (
    <PageFrame width={width} kicker={<Skeleton className="h-2.5 w-32" />} title={title ?? <Skeleton className="mt-3 h-10 w-64 rounded-md" />} description={<Skeleton className="mt-2 h-3.5 w-96 max-w-full" />}>
      <Busy name={name}>{children}</Busy>
    </PageFrame>
  );
}

/**
 * A page's body while it streams, announced once as busy under the page's name. `loading.tsx` shows it under the
 * masthead skeleton; a page whose masthead is already real uses it as its own Suspense fallback.
 */
export function Busy({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={`Loading ${name}`} className="contents">
      <Stack>{children}</Stack>
    </div>
  );
}

/** A row of metric tiles: three unless the page has another number. */
export function TilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Row split="tiles">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3 p-(--card-pad)">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="mt-auto h-8 w-full" />
        </Card>
      ))}
    </Row>
  );
}

/** A card with a title and a chart-sized block. */
export function ChartSkeleton({ height = 'h-40' }: { height?: string }) {
  return (
    <Card className="gap-4 p-(--card-pad)">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-64 max-w-full" />
      <Skeleton className={`${height} w-full rounded-md`} />
    </Card>
  );
}

/** A card holding a data table: a filter bar over `rows` rows. */
export function TableSkeleton({ rows = 8, filters = true }: { rows?: number; filters?: boolean }) {
  return (
    <Card className="gap-4 p-(--card-pad)">
      {filters ? (
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-64 max-w-full rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      ) : null}
      <Skeleton className="h-3 w-full" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-4" />)}
    </Card>
  );
}
