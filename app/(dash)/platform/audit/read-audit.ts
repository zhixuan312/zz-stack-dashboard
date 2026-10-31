import { gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Audit } from '@/lib/fleet-shapes';
import type { BugReport } from '@/lib/platform-shapes';
import { bounded } from '@/lib/read-bound';
import { auditPath, reportTitles, type AuditFilters, type AuditRead } from '@/logic/platform-audit-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/audit` for the address's tab, filters and page, on the console's server, as the person,
 * with the titles of the reports its acts name, given `READ_BOUND_MS` for both: `slow` once it has passed without an
 * answer. It never rejects, so the page's boundary never waits on it longer or falls to the error page, but for a
 * session that ended since the gate let the person in, which goes to sign-in. Nothing is cached: the next request
 * reads again, for its own caller.
 */
export function readAudit(filters: AuditFilters): Promise<AuditRead> {
  const path = auditPath(filters);
  return bounded(
    gatewayGet<Audit>(path).then(
      async (data): Promise<AuditRead> => ({ state: 'ok', path, data, reports: await reportTitles(data, (p) => gatewayGet<BugReport>(p)) }),
      async (err: unknown): Promise<AuditRead> => { await signInWhenEnded(err); return { state: 'failed', path, reason: reasonOf(err) }; },
    ),
    { state: 'slow', path },
  );
}
