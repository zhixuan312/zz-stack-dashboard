import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Record on its way: the lead, a slice's four tiles and two charts, and the record's table. COUPLED: `RecordSkeleton`
 * in `src/views/pages/record.tsx`, the same rows under the masthead once the gate answered; they are written here too
 * because a route's own loading state is held to the page it stands in for by what it draws.
 *
 * Its heading is drawn here for a person whose rail offers Record (`OfferedLoading`), so a press in the rail lands on
 * it at once rather than with the page's own masthead.
 */
export default function RecordLoading() {
  return (
    <OfferedLoading href="/record" kicker={<>{app.name} · {workspaces.main.label}</>}>
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
      <TableSkeleton rows={10} filters={false} />
    </OfferedLoading>
  );
}
