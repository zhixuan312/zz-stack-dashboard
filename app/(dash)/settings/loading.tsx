import { app, workspaces } from '@/app.config';
import { LoadingPage } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { gatedLoading } from '@/data/refusal';

/** Settings on its way: the one line that says where its contents went, at the page's own reading width. */
export default function SettingsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'settings', title: 'Settings', kicker: <>{app.name} · {workspaces.main.label}</> })} width="reading">
      <Skeleton className="h-5 w-full max-w-lg" />
    </LoadingPage>
  );
}
