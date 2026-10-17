import { app, workspaces } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { RecordsSkeleton } from '@/components/templates/records';
import { gatedLoading } from '@/data/refusal';

/** People on its way: four tiles over the filter bar and the table. */
export default function PlatformPeopleLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'people', title: 'People', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <RecordsSkeleton tiles={4} rows={6} />
    </LoadingPage>
  );
}
