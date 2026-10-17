import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/** Bugs on its way: four tiles, the two charts of the weeks side by side, then the queue with its filters. */
export default function PlatformBugsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'bugs', title: 'Bugs', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <TilesSkeleton count={4} />
      <Row split="1/2"><ChartSkeleton height="h-72" /><ChartSkeleton height="h-72" /></Row>
      <TableSkeleton rows={6} />
    </LoadingPage>
  );
}
