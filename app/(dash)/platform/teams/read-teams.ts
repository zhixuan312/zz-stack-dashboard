import { GatewayError, answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { TeamDetail, Teams } from '@/lib/fleet-shapes';
import { bounded } from '@/lib/read-bound';
import type { TeamRead } from '@/logic/team-context';
import type { TeamsRead } from '@/logic/teams-context';
import { teamsPath, type TeamsFilters } from '@/logic/teams-filter';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /teams` for the address's filters, on the console's server, as the person, given `READ_BOUND_MS`,
 * with the revisions it was answered at. It never rejects, so the page's boundary never waits on it longer or falls to
 * the error page, but for a session that ended since the gate let the person in, which goes to sign-in.
 */
export function readTeams(filters: TeamsFilters): Promise<Revised<TeamsRead>> {
  const path = teamsPath(filters);
  return bounded<Revised<TeamsRead>>(
    gatewayGet<Teams>(path).then((data): Revised<TeamsRead> => ({ state: 'ok', path, data, revisions: answeredAt(data) }), async (err: unknown): Promise<TeamsRead> => { await signInWhenEnded(err); return { state: 'failed', path, reason: reasonOf(err) }; }),
    { state: 'slow', path },
  );
}

/** `GET /teams/:slug`, the same way: a slug no team has is `missing`, which the gateway answers with a 404. */
export function readTeam(slug: string): Promise<Revised<TeamRead>> {
  return bounded<Revised<TeamRead>>(
    gatewayGet<TeamDetail>(`/teams/${encodeURIComponent(slug)}`).then(
      (data): Revised<TeamRead> => ({ state: 'ok', data, revisions: answeredAt(data) }),
      async (err: unknown): Promise<Revised<TeamRead>> => {
        await signInWhenEnded(err);
        return err instanceof GatewayError && err.status === 404 ? { state: 'missing', revisions: err.revisions } : { state: 'failed', reason: reasonOf(err) };
      },
    ),
    { state: 'slow' },
  );
}
