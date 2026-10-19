import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { TeamDetail, Teams } from '@/lib/fleet-shapes';
import type { TeamRead } from '@/views/team-context';
import { TEAMS_BOUND_MS, type TeamsRead } from '@/views/teams-context';
import { teamsPath, type TeamsFilters } from '@/views/teams-filter';

/** `read`, or `slow` once `TEAMS_BOUND_MS` has passed without an answer. Neither this nor `read` rejects. */
async function bounded<R>(read: Promise<R>, slow: R): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<R>((resolve) => { timer = setTimeout(() => resolve(slow), TEAMS_BOUND_MS); });
  try {
    return await Promise.race([read, bound]);
  } finally {
    clearTimeout(timer);
  }
}

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /teams` for the address's filters, on the console's server, as the person, given `TEAMS_BOUND_MS`,
 * with the revisions it was answered at. It never rejects, so the page's boundary never waits on it longer or falls to
 * the error page.
 */
export function readTeams(filters: TeamsFilters): Promise<Revised<TeamsRead>> {
  const path = teamsPath(filters);
  return bounded<Revised<TeamsRead>>(
    gatewayGet<Teams>(path).then((data): Revised<TeamsRead> => ({ state: 'ok', path, data, revisions: answeredAt(data) }), (err: unknown): TeamsRead => ({ state: 'failed', path, reason: reasonOf(err) })),
    { state: 'slow', path },
  );
}

/** `GET /teams/:slug`, the same way: a slug no team has is `missing`, which the gateway answers with a 404. */
export function readTeam(slug: string): Promise<Revised<TeamRead>> {
  return bounded<Revised<TeamRead>>(
    gatewayGet<TeamDetail>(`/teams/${encodeURIComponent(slug)}`).then(
      (data): Revised<TeamRead> => ({ state: 'ok', data, revisions: answeredAt(data) }),
      (err: unknown): Revised<TeamRead> => (err instanceof GatewayError && err.status === 404 ? { state: 'missing', revisions: err.revisions } : { state: 'failed', reason: reasonOf(err) }),
    ),
    { state: 'slow' },
  );
}
