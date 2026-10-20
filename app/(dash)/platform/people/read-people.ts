import { answeredAt, gatewayGet, type Revised } from '@/data/gateway';
import type { People } from '@/lib/fleet-shapes';
import { READ_BOUND_MS } from '@/views/context';
import type { PeopleRead, PeopleShown } from '@/views/people-context';
import { peoplePath, type PeopleFilters } from '@/views/people-filter';

const reasonOf = (err: unknown) => (err instanceof Error ? err.message : 'The gateway did not answer.');

/**
 * One page of `GET /people` for the address's filters, on the console's server, as the person, given
 * `READ_BOUND_MS`, with the revisions it was answered at: `slow` once it has passed without an answer. It never
 * rejects, so the page's boundary never waits on it longer or falls to the error page.
 */
export async function readPeople(filters: PeopleFilters): Promise<Revised<PeopleRead>> {
  const path = peoplePath(filters);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<PeopleRead>((resolve) => { timer = setTimeout(() => resolve({ state: 'slow', path }), READ_BOUND_MS); });
  const read = gatewayGet<People>(path).then((data): Revised<PeopleRead> => ({ state: 'ok', path, data, revisions: answeredAt(data) }), (err: unknown): PeopleRead => ({ state: 'failed', path, reason: reasonOf(err) }));
  try {
    return await Promise.race([read, slow]);
  } finally {
    clearTimeout(timer);
  }
}

/** The answer as the page draws it, from the gateway's whole answer: the day each person was added, which the rows are
 *  sorted by where they are read, and the week's sign-ins beyond its count and its start stay on the server. */
function shownPeople({ meta, tiles, people, total }: PeopleShown): PeopleShown {
  const { window, figure } = tiles.signInsLastWeek;
  return {
    meta: { asOf: meta.asOf },
    tiles: { people: tiles.people, withPasskey: tiles.withPasskey, neverSignedIn: tiles.neverSignedIn, signInsLastWeek: { window: { from: window.from }, figure } },
    people: people.map(({ email, name, role, teams, passkeys, lastSignIn, state }) => ({ email, name, role, teams, passkeys, lastSignIn, state })),
    total,
  };
}

/**
 * A read as the page hands it to its view: the people as the page draws them, since what the page hands is written into
 * its HTML beside the rows it draws, and the rest of the gateway's answer would travel in every first load for nothing.
 */
export const handed = (read: Revised<PeopleRead>): Revised<PeopleRead> => (read.state === 'ok' ? { ...read, data: shownPeople(read.data) } : read);
