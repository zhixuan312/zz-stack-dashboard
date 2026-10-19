import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Activity on its way: last week's three tiles, the refusals by week, then the table of refusal groups and the table of
 * events with the bar that filters it. 224px is the chart's 200 and its row of week labels.
 *
 * Its heading is drawn here for a person whose rail offers Activity (`OfferedLoading`), so a press in the rail lands on
 * it at once rather than with the page's own masthead.
 */
export default function ActivityLoading() {
  return (
    <OfferedLoading href="/activity">
      <TilesSkeleton count={3} />
      <ChartSkeleton height="h-56" />
      <TableSkeleton rows={10} />
      <TableSkeleton rows={10} />
    </OfferedLoading>
  );
}
