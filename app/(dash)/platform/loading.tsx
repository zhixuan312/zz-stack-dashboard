import { TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Status on its way, in the shape of the page: what needs attention, the paired figures, the team's tiles and a table.
 * COUPLED: `StatusSkeleton` in src/views/pages/platform-status.tsx, the same blocks under the masthead once the gate
 * answered; they are written here too because a route's own loading state is held to the page it stands in for by what
 * it draws.
 *
 * This is the platform layout's boundary, already mounted when the press comes from another Platform page, so the
 * prefetch of `/platform` carries none of the page's chunks and the page's heading waits for them: Status is named here
 * instead, for a person whose rail offers it and at its own address alone (`OfferedLoading`), never for the other
 * Platform addresses this boundary stands in for.
 */
export default function PlatformStatusLoading() {
  return (
    <OfferedLoading href="/platform">
      <Skeleton className="h-56 rounded-lg" />
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={3} />
      <Skeleton className="h-72 rounded-lg" />
    </OfferedLoading>
  );
}
