import { ChartSkeleton, LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** Runs on its way: three tiles over where the work happens. */
export default function RunsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'runs', title: 'Runs' })}>
      <TilesSkeleton count={3} />
      <ChartSkeleton height="h-96" />
    </LoadingPage>
  );
}
