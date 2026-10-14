import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** People on its way: four tiles over the filterable table. */
export default function PeopleLoading() {
  return (
    <LoadingPage name="people" title="People">
      <RecordsSkeleton tiles={4} rows={8} />
    </LoadingPage>
  );
}
