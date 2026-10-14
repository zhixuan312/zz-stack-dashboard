import { Row } from '@/components/base/shell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';

/** A knowledge node on its way: the lesson beside its facts, then the nodes that share a tag. The title is the record's. */
export default function KnowledgeNodeLoading() {
  return (
    <LoadingPage name="knowledge node">
      <Row split="2/3">
        <Card className="gap-3 p-(--card-pad)">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-3" />)}
        </Card>
        <Card className="gap-3 p-(--card-pad)">
          <Skeleton className="h-4 w-24" />
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-3" />)}
        </Card>
      </Row>
      <TableSkeleton rows={4} filters={false} />
    </LoadingPage>
  );
}
