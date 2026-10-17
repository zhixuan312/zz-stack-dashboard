import { app, workspaces } from '@/app.config';
import { ChartSkeleton, LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** An initiative on its way: its progress, then its documents and its sources. The title is the record's, so it stays a skeleton. */
export default function InitiativeLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'initiative', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <ChartSkeleton height="h-24" />
      <TableSkeleton rows={5} filters={false} />
      <TableSkeleton rows={3} filters={false} />
    </LoadingPage>
  );
}
