import { app, workspaces } from '@/app.config';
import { ChartSkeleton, LoadingPage, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * Approvals on its way: four tiles, the approvals by week, then the tabbed table with its filter bar. COUPLED:
 * `ApprovalsSkeleton` in `src/views/pages/approvals.tsx`, the same rows under the masthead once the gate answered.
 */
export default function ApprovalsLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'approvals', title: 'Approvals', kicker: <>{app.name} · {workspaces.main.label}</> })}>
      <TilesSkeleton count={4} />
      <ChartSkeleton height="h-56" />
      <TableSkeleton rows={10} />
    </LoadingPage>
  );
}
