import { Row } from '@/components/base/shell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartSkeleton, LoadingPage } from '@/components/patterns/page-loading';

/** The Overview on its way: the featured chart beside its three tiles, then the two rows of panels. */
export default function OverviewLoading() {
  return (
    <LoadingPage name="overview" title="Overview">
      <Row split="2/3">
        <ChartSkeleton height="h-72" />
        <div className="flex flex-col gap-(--stack-gap)">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="gap-3 p-(--card-pad)">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </Card>
          ))}
        </div>
      </Row>
      <Row split="2/3"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-56" /><ChartSkeleton height="h-56" /></Row>
    </LoadingPage>
  );
}
