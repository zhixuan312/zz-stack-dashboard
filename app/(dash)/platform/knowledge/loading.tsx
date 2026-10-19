import { app, workspaces } from '@/app.config';
import { Row } from '@/components/base/shell';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Knowledge health on its way, in the shape of the page: four tiles, the table of shelves, the lessons made and the
 * searches by week side by side, then the lessons by the week made beside the lessons by kind. COUPLED:
 * `KnowledgeHealthSkeleton` in src/views/pages/platform-knowledge.tsx, the same blocks under the masthead once the gate
 * answered; they are written here too because a route's own loading state is held to the page it stands in for by what
 * it draws.
 *
 * Its heading is drawn here for a person whose rail offers Knowledge health (`OfferedLoading`), so a press in the rail
 * lands on it at once rather than with the page's own masthead.
 */
export default function PlatformKnowledgeLoading() {
  return (
    <OfferedLoading href="/platform/knowledge" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={3} filters={false} />
      <Row split="1/2"><ChartSkeleton height="h-56" /><ChartSkeleton height="h-56" /></Row>
      <Row split="1/2"><ChartSkeleton height="h-48" /><ChartSkeleton height="h-48" /></Row>
    </OfferedLoading>
  );
}
