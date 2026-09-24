'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { EmptyState, Skeleton } from '@/components/ui';
import type { ApiError } from '@/lib/api';

/**
 * Render a query's three states without every page rewriting them.
 *
 * DELIBERATE: the error is shown in the server's own words. The gateway
 * refuses with a sentence that names the problem — which team does not exist,
 * which door the caller came through — and "something went wrong" would throw
 * away the only diagnosis anybody has.
 */
export function Query<T>({
  query,
  children,
  skeletonRows = 6,
}: {
  query: UseQueryResult<T, ApiError>;
  children: (data: T) => ReactNode;
  skeletonRows?: number;
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (query.error) {
    return (
      <EmptyState
        illustration={{ src: '/assets/brand/state-error.png', width: 74, height: 96 }}
        icon={<AlertTriangle />}
        title={query.error.status === 404 ? 'Not found' : 'Could not load this'}
        description={query.error.message}
      />
    );
  }
  return <>{children(query.data as T)}</>;
}
