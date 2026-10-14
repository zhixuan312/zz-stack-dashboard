import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Initiatives on its way: the filter bar over the table. */
export default function InitiativesLoading() {
  return (
    <LoadingPage name="initiatives" title="Initiatives">
      <RecordsSkeleton rows={10} />
    </LoadingPage>
  );
}
