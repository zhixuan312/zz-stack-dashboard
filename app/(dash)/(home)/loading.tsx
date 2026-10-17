import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TilesSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { gatedLoading } from '@/data/refusal';

/**
 * Home on its way: a page headed by a sentence, so the frame keeps the sentence's block, over the paired figure, the four
 * tiles and the two rows of lists. COUPLED: `home-skeleton.tsx`, the same rows under the masthead once the gate answered;
 * they are written here too because a route's own loading state is held to the page it stands in for by what it draws.
 */
export default function HomeLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'home', title: 'Home' })} sentence>
      <Skeleton className="h-96 rounded-xl" />
      <TilesSkeleton count={4} />
      <Row split="2/3"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-40" /><ChartSkeleton height="h-40" /></Row>
    </LoadingPage>
  );
}
