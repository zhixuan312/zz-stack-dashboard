import { app, workspaces } from '@/app.config';
import { RecordsSkeleton } from '@/components/templates/records';
import { OfferedLoading } from '@/console/offered-loading';

/**
 * Plugins on its way: the table with its filter bar, and no tiles, as the page draws none.
 *
 * Its heading is drawn here for a person whose rail offers Plugins (`OfferedLoading`), so a press in the rail lands on
 * it at once rather than with the page's own masthead.
 */
export default function PluginsLoading() {
  return (
    <OfferedLoading href="/plugins" kicker={<>{app.name} · {workspaces.main.label}</>}>
      <RecordsSkeleton rows={6} />
    </OfferedLoading>
  );
}
