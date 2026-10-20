import { redirect } from 'next/navigation';
import { chromeAccess } from '@/data/access';
import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { InitiativeDetail } from '@/lib/api-shapes';
import type { InitiativeList } from '@/lib/work-shapes';
import { READ_BOUND_MS } from '@/views/context';
import type { InitiativeRead } from '@/views/initiative-context';
import { shownList, type InitiativesRead } from '@/views/initiatives-context';
import { listPath, type InitiativesFilters } from '@/views/initiatives-filter';

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

/** A session that ended since the gate let the person in goes to sign-in, back to `next`; any other failure is the read's. */
function signedOut(err: unknown, next: string): void {
  if (err instanceof GatewayError && err.status === 401) redirect(`/login?next=${encodeURIComponent(next)}`);
}

/**
 * One page of `GET /initiatives` for the address's filters, on the console's server, as the person, given
 * `READ_BOUND_MS`, with the team the person acts for, which a row opens its initiative under, and the revisions
 * it was answered at. It never rejects but for a session that ended, so the page's boundary never waits on it longer or
 * falls to the error page.
 */
export function readInitiatives(filters: InitiativesFilters): Promise<Revised<InitiativesRead>> {
  const path = listPath(filters);
  return bounded<Revised<InitiativesRead>>(
    Promise.all([gatewayGet<InitiativeList>(path), chromeAccess()]).then(
      ([data, { team }]): Revised<InitiativesRead> => ({ state: 'ok', path, data, team: team ?? null, revisions: answeredAt(data) }),
      (err: unknown): InitiativesRead => { signedOut(err, '/initiatives'); return { state: 'failed', path, reason: reasonOf(err) }; },
    ),
    { state: 'slow', path },
  );
}

/**
 * A read as the page hands it to its view: the list as the page draws it, since what the page hands is written into
 * its HTML beside the rows it draws, and the rest of the gateway's answer would travel in every first load for nothing.
 */
export const handed = (read: Revised<InitiativesRead>): Revised<InitiativesRead> => (read.state === 'ok' ? { ...read, data: shownList(read.data) } : read);

/**
 * `GET /initiatives/:team/:slug`, the same way, with the team the person acts for, which a close is made under, and the
 * moment it answered, which the page's freshness is told from. An address no initiative has is `missing`, which the
 * gateway answers with a 404. Both carry the revisions they were answered at.
 */
export function readInitiative(team: string, slug: string): Promise<Revised<InitiativeRead>> {
  const at = `/initiatives/${encodeURIComponent(team)}/${encodeURIComponent(slug)}`;
  return bounded<Revised<InitiativeRead>>(
    Promise.all([gatewayGet<InitiativeDetail>(at), chromeAccess()]).then(
      ([data, access]): Revised<InitiativeRead> => ({ state: 'ok', data, team: access.team ?? null, at: new Date().toISOString(), revisions: answeredAt(data) }),
      (err: unknown): Revised<InitiativeRead> => {
        signedOut(err, at);
        return err instanceof GatewayError && err.status === 404 ? { state: 'missing', revisions: err.revisions } : { state: 'failed', reason: reasonOf(err) };
      },
    ),
    { state: 'slow' },
  );
}
