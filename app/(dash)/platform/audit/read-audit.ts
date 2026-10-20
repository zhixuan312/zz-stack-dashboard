import { gatewayGet } from '@/data/gateway';
import type { Audit } from '@/lib/fleet-shapes';
import type { BugReport } from '@/lib/platform-shapes';
import { READ_BOUND_MS } from '@/views/context';
import { auditPath, reportTitles, type AuditFilters, type AuditRead } from '@/views/platform-audit-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/audit` for the address's tab, filters and page, on the console's server, as the person,
 * with the titles of the reports its acts name, given `READ_BOUND_MS` for both: `slow` once it has passed without an
 * answer. It never rejects, so the page's boundary never waits on it longer or falls to the error page. Nothing is
 * cached: the next request reads again, for its own caller.
 */
export async function readAudit(filters: AuditFilters): Promise<AuditRead> {
  const path = auditPath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<AuditRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), READ_BOUND_MS); });
  const read = gatewayGet<Audit>(path).then(
    async (data): Promise<AuditRead> => ({ state: 'ok', path, data, reports: await reportTitles(data, (p) => gatewayGet<BugReport>(p)) }),
    (err: unknown): AuditRead => ({ state: 'failed', path, reason: reasonOf(err) }),
  );
  try {
    return await Promise.race([read, slow]);
  } finally {
    clearTimeout(timer);
  }
}
