/**
 * People's prepared query: what an agent on `/platform/people` may count, group and compare. `explore_people` counts
 * the people by role and state, a stock, and the recorded console sign-ins by role over any window. Both are the
 * superadmin's, as the page is; the gateway refuses anybody else. A drilled row holds what the page shows of a person,
 * never a token or an enrolment link, and opens People.
 */
import type { PreparedQuery, Source } from '@/lib/explore';

const ROLE = { ops: ['eq' as const], values: ['superadmin', 'member'] };
const WINDOW = 'A window holds complete days of the reporting time zone, so today is in none.';
const PAGE = '/platform/people';

/** The people, a stock counted as of a window's last day. */
const people: Source = {
  collection: 'people', date: 'at',
  filters: { role: ROLE, state: { ops: ['eq'], values: ['active', 'deactivated'] } }, facets: ['role', 'state'],
  measures: { people: { label: 'People', unit: 'people', definition: 'Every person added by the window\'s last day, as they stand now.', agg: 'count' } },
  drill: { columns: ['email', 'name', 'role', 'state'], address: () => PAGE },
  cannot: `People are a stock: a window's start changes nothing. A person's tokens and enrolment links are never shown. ${WINDOW}`,
};

/** The recorded sign-ins, each drilled row a person who signed in, the latest first. */
const signIns: Source = {
  collection: 'sign_ins', date: 'at',
  filters: { role: ROLE }, facets: ['role'], buckets: ['day', 'week', 'month', 'weekday'],
  measures: { signIns: { label: 'Sign-ins', unit: 'sign-ins', definition: 'Console sign-ins recorded in the window.', agg: 'count' } },
  drill: { columns: ['email', 'name', 'role', 'at'], address: () => PAGE },
  cannot: `A drilled row is a person who signed in, the latest first, not each sign-in. A sign-in nobody recorded is not counted. ${WINDOW}`,
};

export const peopleExplore: PreparedQuery = { sources: { people, signIns } };
