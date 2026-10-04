import { PageFrame, Row, Stack } from '@/components/base/shell';
import { Skeleton } from '@/components/ui/skeleton';

/** While a page's code arrives: the masthead and a page-shaped skeleton, so the swap to content moves little. */
export default function DashLoading() {
  return (
    <PageFrame title={<Skeleton className="h-10 w-56" />}>
      <Stack aria-busy="true" aria-label="Loading">
        <Row split="tiles">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}</Row>
        <Skeleton className="h-96 rounded-lg" />
      </Stack>
    </PageFrame>
  );
}
