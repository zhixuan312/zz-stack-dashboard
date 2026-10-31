import { GatewayError, gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { ReleaseDetail, Releases } from '@/lib/platform-shapes';
import { bounded } from '@/lib/read-bound';
import {
  releasePath, releasesPath, type ReleaseRead, type ReleasesFilters, type ReleasesRead,
} from '@/logic/platform-releases-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/releases` for the address's page, on the console's server, as the person, given
 * `READ_BOUND_MS`. It never rejects, so the page's boundary never waits on it longer or falls to the error page, but
 * for a session that ended since the gate let the person in, which goes to sign-in. Nothing is cached: the next request reads again, for its own caller.
 */
export function readReleases(filters: ReleasesFilters): Promise<ReleasesRead> {
  const path = releasesPath(filters);
  return bounded(
    gatewayGet<Releases>(path).then((data): ReleasesRead => ({ state: 'ok', path, data }), async (err: unknown): Promise<ReleasesRead> => { await signInWhenEnded(err); return { state: 'failed', path, reason: reasonOf(err) }; }),
    { state: 'slow', path },
  );
}

/** `GET /platform/releases/:version`, the same way: a version the record does not hold is `missing`, which the gateway answers with a 404. */
export function readRelease(version: string): Promise<ReleaseRead> {
  return bounded(
    gatewayGet<ReleaseDetail>(releasePath(version)).then(
      (data): ReleaseRead => ({ state: 'ok', data }),
      async (err: unknown): Promise<ReleaseRead> => {
        await signInWhenEnded(err);
        return err instanceof GatewayError && err.status === 404 ? { state: 'missing' } : { state: 'failed', reason: reasonOf(err) };
      },
    ),
    { state: 'slow' },
  );
}
