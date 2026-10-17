import { app, workspaces } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gatedLoading } from '@/data/refusal';

/** Plugins on its way: the table with its filter bar, and no tiles, as the page draws none. */
export default function PluginsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'plugins', title: 'Plugins', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <RecordsSkeleton rows={6} />
    </LoadingPage>
  );
}
