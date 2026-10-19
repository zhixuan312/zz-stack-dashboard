import { app, workspaces } from '@/app.config';
import { TableSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Audit on its way. Its heading is drawn here for a person whose rail offers Audit (`OfferedLoading`), so a press in the
 * rail lands on it at once rather than when the page's own masthead has reached the browser.
 *
 * DELIBERATE: the body is the shell's own (`app/(dash)/loading.tsx`), not Audit's tabs and feed, which the page draws
 * once the gate has answered. Audit is the superadmin's: a member is answered here as at an address no page answers,
 * and a page-shaped skeleton streamed before the gate answers would tell them a page stands here (R1-C21).
 */
export default function PlatformAuditLoading() {
  return (
    <OfferedLoading href="/platform/audit" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TableSkeleton rows={8} filters={false} />
    </OfferedLoading>
  );
}
