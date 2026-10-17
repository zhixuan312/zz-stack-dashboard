/**
 * The People list's shared context (decision 0011), and the words its tiles are drawn with: what the page and the
 * assistant are both told about everybody the platform knows. The page draws these words and `view_people` builds the
 * same context from the same response, so the assistant quotes the figures the screen shows.
 *
 * The context names each person on the page by name and state alone, as spec version 8's tool table gives `view_people`:
 * never an email address, a token or an enrolment link. Every figure is the read's, and nothing compares one person
 * with another. A sign-in nobody recorded stays unknown: it is never a date and never a zero.
 */
import type { People, PersonRow } from '@/lib/fleet-shapes';
import type { PeriodFigure } from '@/lib/platform-shapes';
import { plural } from '@/lib/format';
import { formatDate } from '@/lib/format-date';
import { formatCount } from '@/lib/format-units';
import { listed, type Insight, type SharedContext } from '@/lib/shared-context';
import { addressOf, arrived, budgeted, clip, type Arrival } from './context';
import { PAGE_SIZE, PEOPLE_DEFAULTS, narrowed, pageOf, type PeopleFilters, type PeopleRows } from './people-filter';

/** The page's own read, as the console's server or the browser made it: the answer, a failure, or no answer in time. */
export type PeopleRead =
  | { state: 'ok'; path: string; data: People }
  | { state: 'failed'; path: string; reason: string }
  | { state: 'slow'; path: string };

/** How long the console's server waits for a People read: half a second under five, for a phone to draw what it says. */
export const PEOPLE_BOUND_MS = 4_500;

/** The four tiles, as the page labels them and the assistant is told what each counts. */
export const TILES = {
  people: { label: 'People', definition: 'Everybody the platform knows, active or deactivated.' },
  withPasskey: { label: 'With a passkey', definition: 'People with at least one passkey registered.' },
  neverSignedIn: { label: 'Never signed in', definition: 'Active people with no console sign-in recorded.' },
  signInsLastWeek: { label: 'Sign-ins last week', definition: 'Console sign-ins recorded in the last complete Monday week.' },
} as const;

/** What a person with no sign-in on record reads as: a fact about the record, never a guessed date. */
export const NO_SIGN_IN = 'No sign-in recorded';

/** What the week's sign-ins read as: the count, `Unavailable` when it could not be counted, `No data` before the record began. */
export function signInsValue(f: PeriodFigure): string | number {
  if (f.figure.why === 'unavailable') return 'Unavailable';
  if (f.figure.value === null) return 'No data';
  return f.figure.value;
}

/** The sentence a read's trouble is told in, under the table's "The people did not load" and to the assistant. */
export function peopleTrouble(read: Exclude<PeopleRead, { state: 'ok' }>): string {
  return read.state === 'slow' ? `The read did not answer within ${PEOPLE_BOUND_MS / 1000} seconds.` : read.reason;
}

/** How a person is named to the assistant: their name, never their address. */
const nameOf = (p: Pick<PersonRow, 'name'>): string => (p.name.trim() ? clip(p.name.trim()) : 'a person with no name recorded');

/** How many people of a page the context names, and says how many more: ten is a whole page at any length of name. */
const NAMED = 10;

/**
 * `filters` is the page's address. `read` is how `view_people` read the rows, by the route's `limit` and `offset`, when
 * it did: the address is then the page of ten the offset falls in, and rows off the page's grid are said to be so.
 */
export function peopleContext(data: People, { filters, read, ...arrival }: { filters: PeopleFilters; read?: PeopleRows } & Arrival): SharedContext {
  const page = pageOf(filters);
  const rows = data.people;
  const first = read ? read.offset : (page - 1) * PAGE_SIZE;
  const onGrid = !read || (read.limit === PAGE_SIZE && read.offset % PAGE_SIZE === 0);
  const address = addressOf('/platform/people', filters, PEOPLE_DEFAULTS);
  const narrow = narrowed(filters);
  const conditions = [filters.state !== 'all' ? `state ${filters.state}` : '', filters.q.trim() ? `matching "${filters.q.trim()}"` : ''].filter(Boolean).join(', ');
  const scope = `${narrow ? `${formatCount(data.total)} of ${formatCount(data.tiles.people)} people, ${conditions}` : 'everybody the platform knows'}`
    + (rows.length ? `; rows ${first + 1} to ${first + rows.length} of ${formatCount(data.total)}` : '');
  const week = data.tiles.signInsLastWeek;
  const signIns = signInsValue(week);
  const insights: Insight[] = rows.length
    ? [{ text: `The people on this page, by the day they were added, each with their state: ${listed(rows, (p) => `${nameOf(p)} (${p.state})`, 'see the page', NAMED)}.`, evidence: address }]
    : [];
  return budgeted({
    view: 'people',
    title: 'People',
    address,
    scope,
    freshness: arrived(arrival),
    facts: [
      { label: TILES.people.label, value: formatCount(data.tiles.people), definition: TILES.people.definition },
      { label: TILES.withPasskey.label, value: formatCount(data.tiles.withPasskey), definition: TILES.withPasskey.definition },
      { label: TILES.neverSignedIn.label, value: formatCount(data.tiles.neverSignedIn), definition: TILES.neverSignedIn.definition },
      { label: TILES.signInsLastWeek.label, value: typeof signIns === 'number' ? formatCount(signIns) : signIns, definition: `${TILES.signInsLastWeek.definition} The week of ${formatDate(week.window.from)}.` },
      ...(narrow ? [{ label: 'Matching', value: formatCount(data.total), definition: 'The people the filters let through; the tiles count everybody.' }] : []),
    ],
    insights,
    unknowns: [
      'People are named here by name and state alone: their addresses, their tokens and any enrolment link are not part of this context.',
      `A person with no sign-in on record reads "${NO_SIGN_IN}": the record holds none, which is not a date and not a zero.`,
      ...(week.figure.why === 'unavailable' ? ['The sign-ins could not be counted, so last week\'s figure is not stated.'] : []),
      ...(week.figure.why === 'no_data' ? ['No sign-in was recorded before last week ended, so there is no figure for it.'] : []),
      ...(onGrid ? [] : [`The page lists the people ten a page, so ${address} does not show exactly these ${formatCount(rows.length)} rows.`]),
      ...(data.total > first + rows.length ? [`${formatCount(data.total - first - rows.length)} more ${plural(data.total - first - rows.length, 'person', 'people')} match on later pages.`] : []),
      ...(rows.length ? [] : [narrow ? 'Nobody matches these filters.' : 'Nobody has been added yet; a superadmin adds the first person on this page.']),
    ],
  });
}
