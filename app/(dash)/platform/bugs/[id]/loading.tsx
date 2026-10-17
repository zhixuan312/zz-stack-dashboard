import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { LoadingPage } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { gatedLoading } from '@/data/refusal';

/** A report on its way: its words beside what it is, then what was decided or the form that resolves it. */
export default function PlatformBugLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'bug', title: 'Bug report', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <Row split="2/3"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></Row>
      <Skeleton className="h-48 rounded-lg" />
    </LoadingPage>
  );
}
