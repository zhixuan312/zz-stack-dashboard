import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Activity on its way: the table of events, which has no filter bar. */
export default function ActivityLoading() {
  return (
    <LoadingPage name="activity" title="Activity">
      <RecordsSkeleton rows={10} filters={false} />
    </LoadingPage>
  );
}
