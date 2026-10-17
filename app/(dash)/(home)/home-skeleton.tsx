import { Row } from '@/components/base/shell';
import { ChartSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';

/** Home's body on its way under its masthead: the paired figure, the four tiles, then the two rows of lists. COUPLED: `loading.tsx` draws the same rows. */
export function HomeSkeleton() {
  return (
    <>
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={4} />
      <Row split="2/3"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-40" /><ChartSkeleton height="h-40" /></Row>
    </>
  );
}
