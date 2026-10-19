import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Usage on its way, in the shape of the page: four tiles, the calls by week, the refusals put right, the two
 * compositions side by side and the table of tools. COUPLED: `UsageSkeleton` in src/views/pages/platform-usage.tsx,
 * the same blocks under the masthead once the gate answered; they are written here too because a route's own loading
 * state is held to the page it stands in for by what it draws.
 *
 * Its heading is drawn here for a person whose rail offers Usage (`OfferedLoading`), so a press in the rail lands on it
 * at once rather than with the page's own masthead.
 */
export default function PlatformUsageLoading() {
  return (
    <OfferedLoading href="/platform/usage" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-56" />
      <ChartSkeleton height="h-56" />
      <Row split="1/2"><ChartSkeleton height="h-20" /><ChartSkeleton height="h-20" /></Row>
      <TableSkeleton rows={4} filters={false} />
    </OfferedLoading>
  );
}
