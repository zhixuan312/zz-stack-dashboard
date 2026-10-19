import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Bugs on its way: four tiles, the queue with its filters, then the two charts of the weeks side by side.
 *
 * Its heading is drawn here for a person whose rail offers Bugs (`OfferedLoading`), so a press in the rail lands on it
 * at once rather than with the page's own masthead.
 */
export default function PlatformBugsLoading() {
  return (
    <OfferedLoading href="/platform/bugs" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={6} />
      <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>
    </OfferedLoading>
  );
}
