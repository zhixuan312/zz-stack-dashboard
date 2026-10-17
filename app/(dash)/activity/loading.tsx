import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * Activity on its way: last week's three tiles, the refusals by week, then the table of refusal groups and the table of
 * events with the bar that filters it. 224px is the chart's 200 and its row of week labels.
 */
export default function ActivityLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'activity', title: 'Activity' })}>
      <TilesSkeleton count={3} />
      <ChartSkeleton height="h-56" />
      <TableSkeleton rows={10} />
      <TableSkeleton rows={10} />
    </LoadingPage>
  );
}
