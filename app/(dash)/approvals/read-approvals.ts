import { chromeAccess } from '@/data/access';
import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { Approvals } from '@/lib/work-shapes';
import { approvalsPath, type ApprovalsFilters, type ApprovalsRead } from '@/logic/approvals-context';
import { bounded } from '@/lib/read-bound';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * `GET /approvals` for the address's tab and page, on the console's server, as the person, given `READ_BOUND_MS`,
 * with the team the person acts for, which a row opens its document under, and the revisions it was answered at. It
 * never rejects but for a session that ended since the gate let the person in, which goes to sign-in, so the page's
 * boundary never waits on it longer or falls to the error page. Nothing is cached: the next request reads again, for its
 * own caller.
 */
export function readApprovals(filters: ApprovalsFilters): Promise<Revised<ApprovalsRead>> {
  const path = approvalsPath(filters);
  return bounded<Revised<ApprovalsRead>>(
    Promise.all([gatewayGet<Approvals>(path), chromeAccess()]).then(
      ([data, { team }]): Revised<ApprovalsRead> => ({ state: 'ok', path, data, team: team ?? null, revisions: answeredAt(data) }),
      async (err: unknown): Promise<ApprovalsRead> => {
        await signInWhenEnded(err);
        return { state: 'failed', path, reason: reasonOf(err) };
      },
    ),
    { state: 'slow', path },
  );
}
