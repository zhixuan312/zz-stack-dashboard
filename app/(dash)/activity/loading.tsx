import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Activity on its way: last week's tiles over the table of events, with the bar that filters it by kind and tool. */
export default function ActivityLoading() {
  return (
    <LoadingPage name="activity" title="Activity">
      <RecordsSkeleton tiles={3} rows={10} />
    </LoadingPage>
  );
}
