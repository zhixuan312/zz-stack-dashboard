import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';

/** Plugins on its way: four tiles over the table, which has no filter bar. */
export default function PluginsLoading() {
  return (
    <LoadingPage name="plugins" title="Plugins">
      <RecordsSkeleton tiles={4} rows={6} filters={false} />
    </LoadingPage>
  );
}
