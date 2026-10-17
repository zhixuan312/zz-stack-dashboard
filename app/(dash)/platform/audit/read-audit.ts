import { gatewayGet } from '@/data/gateway';
import type { Audit } from '@/lib/fleet-shapes';
import { AUDIT_BOUND_MS, auditPath, type AuditFilters, type AuditRead } from '@/views/platform-audit-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/audit` for the address's tab, filters and page, on the console's server, as the person,
 * given `AUDIT_BOUND_MS`: `slow` once it has passed without an answer. It never rejects, so the page's boundary never
 * waits on it longer or falls to the error page. Nothing is cached: the next request reads again, for its own caller.
 */
export async function readAudit(filters: AuditFilters): Promise<AuditRead> {
  const path = auditPath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<AuditRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), AUDIT_BOUND_MS); });
  const read = gatewayGet<Audit>(path).then((data): AuditRead => ({ state: 'ok', path, data }), (err: unknown): AuditRead => ({ state: 'failed', path, reason: reasonOf(err) }));
  try {
    return await Promise.race([read, slow]);
  } finally {
    clearTimeout(timer);
  }
}
