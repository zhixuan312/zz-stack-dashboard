import { GatewayError, gatewayGet } from '@/data/gateway';
import type { BugReport, Bugs } from '@/lib/platform-shapes';
import { READ_BOUND_MS } from '@/views/context';
import {
  bugPath, bugsPath, duplicatesPath, type BugDuplicates, type BugRead, type BugsFilters, type BugsRead, type DuplicatesRead,
} from '@/views/platform-bugs-context';

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
 * One page of `GET /platform/bugs` for the address's filters and page, on the console's server, as the person, given
 * `READ_BOUND_MS`. It never rejects, so the page's boundary never waits on it longer or falls to the error page.
 * Nothing is cached: the next request reads again, for its own caller.
 */
export function readBugs(filters: BugsFilters): Promise<BugsRead> {
  const path = bugsPath(filters);
  return bounded(
    gatewayGet<Bugs>(path).then((data): BugsRead => ({ state: 'ok', path, data }), (err: unknown): BugsRead => ({ state: 'failed', path, reason: reasonOf(err) })),
    { state: 'slow', path },
  );
}

/** `GET /platform/bugs/:id`, the same way: an id that names no report is `missing`, which the gateway answers with a 404. */
export function readBug(id: string): Promise<BugRead> {
  return bounded(
    gatewayGet<BugReport>(bugPath(id)).then(
      (data): BugRead => ({ state: 'ok', data }),
      (err: unknown): BugRead => (err instanceof GatewayError && err.status === 404 ? { state: 'missing' } : { state: 'failed', reason: reasonOf(err) }),
    ),
    { state: 'slow' },
  );
}

/** `GET /platform/bugs/:id/duplicates`, beside the report: the targets the resolve form offers, and nothing else. */
export function readDuplicates(id: string): Promise<DuplicatesRead> {
  return bounded(
    gatewayGet<BugDuplicates>(duplicatesPath(id)).then((data): DuplicatesRead => ({ state: 'ok', data }), (err: unknown): DuplicatesRead => ({ state: 'failed', reason: reasonOf(err) })),
    { state: 'slow' },
  );
}
