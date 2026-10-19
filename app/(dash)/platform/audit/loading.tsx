import { app, workspaces } from '@/app.config';
import { OfferedLoading } from '@/console/offered-loading';
import { AuditSkeleton } from './audit-skeleton';

/**
 * Audit on its way: the two tabs, then the acts of administration its plain address opens on. Its heading is drawn
 * here for a person whose rail offers Audit (`OfferedLoading`), so a press in the rail lands on it at once rather than
 * when the page's own masthead has reached the browser.
 */
export default function PlatformAuditLoading() {
  return (
    <OfferedLoading href="/platform/audit" kicker={<>{app.name} · {workspaces.platform.label}</>}>
      <AuditSkeleton />
    </OfferedLoading>
  );
}
