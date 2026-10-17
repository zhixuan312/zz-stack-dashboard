import { app, workspaces } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gatedLoading } from '@/data/refusal';

/** Teams on its way: four tiles over the filter bar and the table. */
export default function PlatformTeamsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'teams', title: 'Teams', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <RecordsSkeleton tiles={4} rows={6} />
    </LoadingPage>
  );
}
