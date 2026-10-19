import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RecordsSkeleton } from '@/components/templates/records';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Knowledge on its way: the search it leads with, then its four tiles over the filterable shelf. Its heading is drawn
 * here for a person whose rail offers Knowledge (`OfferedLoading`), so a press in the rail lands on it at once rather
 * than with the summary the page waits on.
 */
export default function KnowledgeLoading() {
  return (
    <OfferedLoading href="/knowledge">
      <Card className="gap-3 p-(--card-pad)">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9" />
      </Card>
      <RecordsSkeleton tiles={4} rows={10} />
    </OfferedLoading>
  );
}
