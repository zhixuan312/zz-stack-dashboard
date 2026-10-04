'use client';

import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { ApiError } from '@/lib/api';

/**
 * One read, three states: a skeleton while it loads, the gateway's own sentence with Retry when it fails, and the
 * children with the data once it arrives. Every panel goes through this, so no panel invents its own loading or
 * error look.
 */
export function Query<T>({
  query,
  children,
  skeletonRows = 6,
  skeleton,
  what = 'This',
}: {
  query: UseQueryResult<T, ApiError>;
  children: (data: T) => ReactNode;
  skeletonRows?: number;
  /** The shape of what is coming, when it is a page rather than a list, so the swap moves as little as possible. */
  skeleton?: ReactNode;
  /** What is loading, for the failure's title: "The overview" reads "The overview did not load". */
  what?: string;
}) {
  // A refused read (no session) draws as loading: the gate is already sending the person to sign in.
  if (query.isPending || query.error?.status === 401) {
    if (skeleton) return <>{skeleton}</>;
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: skeletonRows }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
      </div>
    );
  }
  if (query.error) {
    return (
      <EmptyState
        kind={query.error.status === 404 ? 'filtered' : 'error'}
        title={query.error.status === 404 ? `${what} does not exist` : `${what} did not load`}
        action={<Button size="sm" variant="secondary" busy={query.isFetching} onClick={() => void query.refetch()}>Retry</Button>}
      >
        {query.error.message}
      </EmptyState>
    );
  }
  return <>{children(query.data as T)}</>;
}

/** What failed, for a data table's error state; nothing for a refused read, which the gate turns into a sign-in. */
export function failureOf(query: { error: ApiError | null }): string | undefined {
  return query.error && query.error.status !== 401 ? query.error.message : undefined;
}
