import { app, workspaces } from '@/app.config';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** A team on its way: its four tiles, its calls by week beside the team, then its members. The title is the slug, so it stays a skeleton. */
export default function PlatformTeamLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'team', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-56" />
      <TableSkeleton rows={4} filters={false} />
    </LoadingPage>
  );
}
