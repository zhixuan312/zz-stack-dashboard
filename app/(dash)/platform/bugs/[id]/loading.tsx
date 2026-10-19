import { app, workspaces } from '@/app.config';
import { LoadingPage, TableSkeleton } from '@/components/patterns/page-loading';
import { gatedLoading } from '@/data/refusal';

/**
 * A report on its way.
 *
 * DELIBERATE: the body is the shell's own (`app/(dash)/loading.tsx`), not the report's words and what was decided,
 * which the page draws once the gate has answered. A report's page is the superadmin's: a member is answered here as at
 * an address no page answers, and a page-shaped skeleton streamed before the gate answers would tell them a page
 * stands here (R1-C21).
 */
export default function PlatformBugLoading() {
  return (
    <LoadingPage {...gatedLoading({ name: 'bug', title: 'Bug report', kicker: <>{app.name} · {workspaces.platform.label}</> })}>
      <TableSkeleton rows={8} filters={false} />
    </LoadingPage>
  );
}
