import { app, workspaces } from '@/app.config';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Initiatives on its way: three tiles, the filter bar over the table, then the closures by week.
 *
 * Its heading is drawn here for a person whose rail offers Initiatives (`OfferedLoading`), so a press in the rail lands
 * on it at once rather than with the page's own masthead.
 */
export default function InitiativesLoading() {
  return (
    <OfferedLoading href="/initiatives" kicker={<>{app.name} · {workspaces.main.label}</>}>
      <TilesSkeleton count={3} />
      <TableSkeleton rows={10} />
      <ChartSkeleton height="h-56" />
    </OfferedLoading>
  );
}
