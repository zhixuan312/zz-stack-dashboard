import { GatewayError, gatewayGet } from '@/data/gateway';
import { signInWhenEnded } from '@/data/sign-in';
import type { BugReport, Bugs } from '@/lib/platform-shapes';
import { bounded } from '@/lib/read-bound';
import {
  bugPath, bugsPath, duplicatesPath, type BugDuplicates, type BugRead, type BugsFilters, type BugsRead, type DuplicatesRead,
} from '@/logic/platform-bugs-context';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /platform/bugs` for the address's filters and page, on the console's server, as the person, given
 * `READ_BOUND_MS`. It never rejects, so the page's boundary never waits on it longer or falls to the error page, but
 * for a session that ended since the gate let the person in, which goes to sign-in. Nothing is cached: the next request reads again, for its own caller.
 */
export function readBugs(filters: BugsFilters): Promise<BugsRead> {
  const path = bugsPath(filters);
  return bounded(
    gatewayGet<Bugs>(path).then((data): BugsRead => ({ state: 'ok', path, data }), async (err: unknown): Promise<BugsRead> => { await signInWhenEnded(err); return { state: 'failed', path, reason: reasonOf(err) }; }),
    { state: 'slow', path },
  );
}

/** `GET /platform/bugs/:id`, the same way: an id that names no report is `missing`, which the gateway answers with a 404. */
export function readBug(id: string): Promise<BugRead> {
  return bounded(
    gatewayGet<BugReport>(bugPath(id)).then(
      (data): BugRead => ({ state: 'ok', data }),
      async (err: unknown): Promise<BugRead> => {
        await signInWhenEnded(err);
        return err instanceof GatewayError && err.status === 404 ? { state: 'missing' } : { state: 'failed', reason: reasonOf(err) };
      },
    ),
    { state: 'slow' },
  );
}

/** `GET /platform/bugs/:id/duplicates`, beside the report: the targets the resolve form offers, and nothing else. */
export function readDuplicates(id: string): Promise<DuplicatesRead> {
  return bounded(
    gatewayGet<BugDuplicates>(duplicatesPath(id)).then((data): DuplicatesRead => ({ state: 'ok', data }), async (err: unknown): Promise<DuplicatesRead> => { await signInWhenEnded(err); return { state: 'failed', reason: reasonOf(err) }; }),
    { state: 'slow' },
  );
}
