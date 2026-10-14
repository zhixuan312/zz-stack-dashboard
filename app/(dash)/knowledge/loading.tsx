import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Knowledge on its way: four tiles over the filterable table of nodes. */
export default function KnowledgeLoading() {
  return (
    <LoadingPage name="knowledge" title="Knowledge">
      <RecordsSkeleton tiles={4} rows={10} />
    </LoadingPage>
  );
}
