import { GatewayError, gatewayGet } from '@/data/gateway';
import type { ReleaseDetail, Releases } from '@/lib/platform-shapes';
import {
  RELEASES_BOUND_MS, releasePath, releasesPath, type ReleaseRead, type ReleasesFilters, type ReleasesRead,
} from '@/views/platform-releases-context';

/** `read`, or `slow` once `RELEASES_BOUND_MS` has passed without an answer. Neither this nor `read` rejects. */
async function bounded<R>(read: Promise<R>, slow: R): Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<R>((resolve) => { timer = setTimeout(() => resolve(slow), RELEASES_BOUND_MS); });
  try {
    return await Promise.race([read, bound]);
  } finally {
    clearTimeout(timer);
  }
}

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/releases` for the address's page, on the console's server, as the person, given
 * `RELEASES_BOUND_MS`. It never rejects, so the page's boundary never waits on it longer or falls to the error page.
 * Nothing is cached: the next request reads again, for its own caller.
 */
export function readReleases(filters: ReleasesFilters): Promise<ReleasesRead> {
  const path = releasesPath(filters);
  return bounded(
    gatewayGet<Releases>(path).then((data): ReleasesRead => ({ state: 'ok', path, data }), (err: unknown): ReleasesRead => ({ state: 'failed', path, reason: reasonOf(err) })),
    { state: 'slow', path },
  );
}

/** `GET /platform/releases/:version`, the same way: a version the record does not hold is `missing`, which the gateway answers with a 404. */
export function readRelease(version: string): Promise<ReleaseRead> {
  return bounded(
    gatewayGet<ReleaseDetail>(releasePath(version)).then(
      (data): ReleaseRead => ({ state: 'ok', data }),
      (err: unknown): ReleaseRead => (err instanceof GatewayError && err.status === 404 ? { state: 'missing' } : { state: 'failed', reason: reasonOf(err) }),
    ),
    { state: 'slow' },
  );
}
