import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { People } from '@/lib/fleet-shapes';
import { PEOPLE_BOUND_MS, type PeopleRead } from '@/views/people-context';
import { peoplePath, type PeopleFilters } from '@/views/people-filter';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /people` for the address's filters, on the console's server, as the person, given
 * `PEOPLE_BOUND_MS`, with the revisions it was answered at: `slow` once it has passed without an answer. It never
 * rejects, so the page's boundary never waits on it longer or falls to the error page.
 */
export async function readPeople(filters: PeopleFilters): Promise<Revised<PeopleRead>> {
  const path = peoplePath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<PeopleRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), PEOPLE_BOUND_MS); });
  const read = gatewayGet<People>(path).then((data): Revised<PeopleRead> => ({ state: 'ok', path, data, revisions: answeredAt(data) }), (err: unknown): PeopleRead => ({ state: 'failed', path, reason: reasonOf(err) }));
  try {
    return await Promise.race([read, slow]);
  } finally {
    clearTimeout(timer);
  }
}
