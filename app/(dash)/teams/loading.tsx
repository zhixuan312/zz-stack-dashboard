import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Teams on its way: the filter bar over the table. */
export default function TeamsLoading() {
  return (
    <LoadingPage name="teams" title="Teams">
      <RecordsSkeleton rows={6} />
    </LoadingPage>
  );
}
