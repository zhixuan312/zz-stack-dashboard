import { app, workspaces } from '@/app.config';
import { RecordsSkeleton } from '@/components/templates/records';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Teams on its way: four tiles over the filter bar and the table.
 *
 * Its heading is drawn here for a person whose rail offers Teams (`OfferedLoading`), so a press in the rail lands on it
 * at once rather than with the page's own masthead.
 */
export default function PlatformTeamsLoading() {
  return (
    <OfferedLoading href="/platform/teams" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <RecordsSkeleton tiles={4} rows={6} />
    </OfferedLoading>
  );
}
