import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gatedLoading } from '@/data/refusal';

/** Knowledge on its way: the search it leads with, then its four tiles over the filterable shelf. */
export default function KnowledgeLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'knowledge', title: 'Knowledge' })}>
      <Card className="gap-3 p-(--card-pad)">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9" />
      </Card>
      <RecordsSkeleton tiles={4} rows={10} />
    </LoadingPage>
  );
}
