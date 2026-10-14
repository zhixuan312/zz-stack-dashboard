import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** The knowledge log on its way: three tiles over the table of entries. Its heading is Knowledge, as the page's is. */
export default function KnowledgeLogLoading() {
  return (
    <LoadingPage name="knowledge log" title="Knowledge">
      <RecordsSkeleton tiles={3} rows={10} filters={false} />
    </LoadingPage>
  );
}
