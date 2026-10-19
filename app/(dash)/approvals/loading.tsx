import { app, workspaces } from '@/app.config';
import { ChartSkeleton, TableSkeleton, TilesSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Approvals on its way: four tiles, the tabbed table with its filter bar, then the approvals by week. COUPLED:
 * `ApprovalsSkeleton` in `src/views/pages/approvals.tsx`, the same rows under the masthead once the gate answered.
 *
 * Its heading is drawn here for a person whose rail offers Approvals (`OfferedLoading`), so a press in the rail lands
 * on it at once rather than with the page's own masthead.
 */
export default function ApprovalsLoading() {
  return (
    <OfferedLoading href="/approvals" kicker={<>{app.name} · {workspaces.main.label}</>}>
      <TilesSkeleton count={4} />
      <TableSkeleton rows={10} />
      <ChartSkeleton height="h-56" />
    </OfferedLoading>
  );
}
