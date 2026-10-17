import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * Knowledge health on its way, in the shape of the page: four tiles, the table of shelves, the lessons made and the
 * searches by week side by side, then the lessons by the week made beside the lessons by kind. COUPLED:
 * `KnowledgeHealthSkeleton` in src/views/pages/platform-knowledge.tsx, the same blocks under the masthead once the gate
 * answered; they are written here too because a route's own loading state is held to the page it stands in for by what
 * it draws.
 */
export default function PlatformKnowledgeLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'knowledge-health', title: 'Knowledge health', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={3} filters={false} />
      <Row split="1/2"><ChartSkeleton height="h-56" /><ChartSkeleton height="h-56" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
    </LoadingPage>
  );
}
