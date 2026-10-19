import { app, workspaces } from '@/app.config';
import { TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Runs on its way: the three tiles, the runs by skill, and the recent runs. COUPLED: `RunsSkeleton` in
 * `src/views/pages/runs.tsx`, the same rows under the masthead once the gate answered; they are written here too
 * because a route's own loading state is held to the page it stands in for by what it draws.
 *
 * Its heading is drawn here for a person whose rail offers Runs (`OfferedLoading`), so a press in the rail lands on it
 * at once rather than with the page's own masthead.
 */
export default function RunsLoading() {
  return (
    <OfferedLoading href="/runs" kicker={<>{app.name} · {workspaces.main.label}</>}>
      <TilesSkeleton count={3} />
      <Skeleton className="h-96 rounded-xl" />
      <TableSkeleton rows={10} filters={false} />
    </OfferedLoading>
  );
}
