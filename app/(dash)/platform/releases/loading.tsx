import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Releases on its way: four tiles, the two charts of the weeks side by side, then the table.
 *
 * Its heading is drawn here for a person whose rail offers Releases (`OfferedLoading`), so a press in the rail lands on
 * it at once rather than with the page's own masthead.
 */
export default function PlatformReleasesLoading() {
  return (
    <OfferedLoading href="/platform/releases" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>
      <TableSkeleton rows={6} filters={false} />
    </OfferedLoading>
  );
}
