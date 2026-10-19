import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';
import { Skeleton } from '@/components/ui/skeleton';
import { gatedLoading } from '@/data/refusal';

/** A release on its way: its changelog beside what it is, then its two windows. The title is the version, so it stays a skeleton. */
export default function PlatformReleaseLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'release', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <Row split="2/3"><Skeleton className="h-72 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></Row>
      <TableSkeleton rows={2} filters={false} />
    </LoadingPage>
  );
}
