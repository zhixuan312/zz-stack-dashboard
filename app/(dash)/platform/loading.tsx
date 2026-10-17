import { LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { gatedLoading } from '@/data/refusal';

/**
 * Status on its way, in the shape of the page: what needs attention, the paired figures, the team's tiles and a table.
 * COUPLED: `StatusSkeleton` in src/views/pages/platform-status.tsx, the same blocks under the masthead once the gate
 * answered; they are written here too because a route's own loading state is held to the page it stands in for by what
 * it draws.
 */
export default function PlatformStatusLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'status', title: 'Status' })}>
      <Skeleton className="h-56 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={3} />
      <Skeleton className="h-72 rounded-lg" />
    </LoadingPage>
  );
}
