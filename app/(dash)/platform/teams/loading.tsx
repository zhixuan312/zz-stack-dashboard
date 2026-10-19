import { app, workspaces } from '@/app.config';
import { TableSkeleton } from '@/components/patterns/page-loading';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Teams on its way. Its heading is drawn here for a person whose rail offers Teams (`OfferedLoading`), so a press in
 * the rail lands on it at once rather than with the page's own masthead.
 *
 * DELIBERATE: the body is the shell's own (`app/(dash)/loading.tsx`), not Teams' tiles and table, which the page draws
 * once the gate has answered. Teams is the superadmin's: a member is answered here as at an address no page answers,
 * and a page-shaped skeleton streamed before the gate answers would tell them a page stands here (R1-C21).
 */
export default function PlatformTeamsLoading() {
  return (
    <OfferedLoading href="/platform/teams" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <TableSkeleton rows={8} filters={false} />
    </OfferedLoading>
  );
}
