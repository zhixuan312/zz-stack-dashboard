import { app, workspaces } from '@/app.config';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** Initiatives on its way: three tiles, the closures by week, then the filter bar over the table. */
export default function InitiativesLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'initiatives', title: 'Initiatives', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <TilesSkeleton count={3} />
      <ChartSkeleton height="h-56" />
      <TableSkeleton rows={10} />
    </LoadingPage>
  );
}
