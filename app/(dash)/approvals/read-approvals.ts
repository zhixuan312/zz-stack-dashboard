import { redirect } from 'next/navigation';
import { chromeAccess } from '@/data/access';
import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { Approvals } from '@/lib/work-shapes';
import { approvalsPath, type ApprovalsFilters, type ApprovalsRead } from '@/views/approvals-context';
import { READ_BOUND_MS } from '@/views/context';

/** `read`, or `slow` once `READ_BOUND_MS` has passed without an answer. Neither this nor `read` rejects. */
async function bounded<R>(read: Promise<R>, slow: R): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<R>((resolve) => { timer = setTimeout(() => resolve(slow), READ_BOUND_MS); });
  try {
    return await Promise.race([read, bound]);
  } finally {
    clearTimeout(timer);
  }
}

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
      (err: unknown): ApprovalsRead => {
        if (err instanceof GatewayError && err.status === 401) redirect('/login?next=%2Fapprovals');
        return { state: 'failed', path, reason: reasonOf(err) };
      },
    ),
    { state: 'slow', path },
  );
}
