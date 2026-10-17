import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * Evaluation on its way, in the shape of the page: four tiles, the table of plugins, every score by series, the
 * findings by decision and by owner side by side, and the findings waiting. COUPLED: `EvaluationSkeleton` in
 * src/views/pages/platform-evaluation.tsx, the same blocks under the masthead once the gate answered; they are written
 * here too because a route's own loading state is held to the page it stands in for by what it draws.
 */
export default function PlatformEvaluationLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'evaluation', title: 'Evaluation', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={3} filters={false} />
      <TableSkeleton rows={4} filters={false} />
      <Row split="1/2"><ChartSkeleton height="h-40" /><ChartSkeleton height="h-40" /></Row>
      <TableSkeleton rows={2} filters={false} />
    </LoadingPage>
  );
}
