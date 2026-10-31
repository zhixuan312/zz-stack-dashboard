/**
 * The fake gateway's people: what `GET /api/console/people` answers, and a team's roster under `/settings`.
 *
 * Synthetic on purpose, as people.ts says: every address is under `example.com`. One fixture, the people as the
 * superadmin reads them. The superadmin reads every person with their passkeys, their last recorded sign-in and their
 * state, filtered and paged on the server; anybody else is refused the read, as the gateway refuses it.
 *
 * The cast covers the states the page draws: a person who never signed in, a deactivated one with sign-ins before,
 * a superadmin in no team of the others, a person in two teams, and a name long enough to wrap. A journey session
 * reads the people it added, and nobody else does (journey.ts).
 *
 * COUPLED: zz-stack's `checks/console-platform-people.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me, TeamMembers } from '../../src/lib/api-shapes.ts';
import type { FixtureAnswer } from './envelope.ts';
import type { People, PersonRow } from '../../src/lib/fleet-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { day, iso, localDay, now } from './clock.ts';
import { kept } from './journey.ts';
import { ME, MEMBER } from './people.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { REPEATED, pageOf, repeated } from './work-activity.ts';
import { inWeek, WEEKS } from './work-initiatives.ts';

type Seed = {
  email: string; name: string; role: 'superadmin' | 'member'; status: 'active' | 'deactivated'; created: number;
  teams: [string, 'admin' | 'member'][]; passkeys: number; signIns: [back: number, hours: number][];
};

const SEEDS: Seed[] = [
  { email: ME.email, name: ME.name, role: 'superadmin', status: 'active', created: 88, teams: [['atlas', 'admin'], ['beacon', 'member']],
    passkeys: 2, signIns: [[0, 0], [1, 10], [1, 58], [2, 30]] },
  { email: MEMBER.email, name: MEMBER.name, role: 'member', status: 'active', created: 64, teams: [['atlas', 'admin']],
    passkeys: 1, signIns: [[1, 20], [3, 4]] },
  { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', status: 'active', created: 60, teams: [['atlas', 'member'], ['beacon', 'member']],
    passkeys: 1, signIns: [[2, 30]] },
  { email: 'jonas.weber@example.com', name: 'Jonas Weber', role: 'member', status: 'active', created: 51, teams: [['beacon', 'admin']],
    passkeys: 1, signIns: [[1, 50], [4, 70]] },
  { email: 'maximiliana.fitzgerald-oyelaran@example.com', name: 'Maximiliana Fitzgerald-Oyelaran Kowalczyk', role: 'member', status: 'active', created: 40, teams: [['atlas', 'member']],
    passkeys: 0, signIns: [] },
  { email: 'leo.santos@example.com', name: 'Leo Santos', role: 'member', status: 'deactivated', created: 88, teams: [['cinder', 'admin']],
    passkeys: 1, signIns: [[5, 3]] },
  { email: 'sam.reyes@example.com', name: 'Sam Reyes', role: 'superadmin', status: 'active', created: 30, teams: [['dune', 'admin']],
    passkeys: 1, signIns: [[1, 90]] },
  { email: 'iris.moreau@example.com', name: 'Iris Moreau', role: 'member', status: 'active', created: 40, teams: [['ember', 'admin']],
    passkeys: 1, signIns: [[1, 8]] },
  { email: 'kofi.mensah@example.com', name: 'Kofi Mensah', role: 'member', status: 'active', created: 35, teams: [['fjord', 'admin'], ['ember', 'member']],
    passkeys: 1, signIns: [[2, 12]] },
];

/** Every person as the superadmin's list reads them, in the gateway's order: by the day they were added, then email. */
export const PEOPLE: PersonRow[] = SEEDS.map((s) => {
  const signIns = s.signIns.map(([back, hours]) => inWeek(back, hours));
  return {
    email: s.email, name: s.name, role: s.role, created: day(s.created), teams: s.teams.map(([t, r]) => `${t} (${r})`),
    passkeys: s.passkeys, lastSignIn: signIns.length ? iso(Math.max(...signIns)) : null, state: s.status,
  };
}).sort((a, b) => a.created.localeCompare(b.created) || a.email.localeCompare(b.email));

/** The first recorded sign-in, where the gateway says its record of them begins. */
const FIRST_SIGN_IN = iso(Math.min(...SEEDS.flatMap((s) => s.signIns.map(([back, hours]) => inWeek(back, hours)))));

/** The recorded sign-ins in the last complete week, every person's. */
const SIGN_INS_LAST_WEEK: PeriodFigure = (() => {
  const n = SEEDS.reduce((sum, s) => sum + s.signIns.filter(([back]) => back === 1).length, 0);
  return { window: WEEKS.at(-2)!, figure: { value: n, why: null }, numerator: n, denominator: null };
})();

const STATES = ['active', 'deactivated'];

/**
 * `GET /people`, as `who`: refused as the gateway refuses it, in its order, a filter or the page given twice, then a
 * filter value it does not take, then a page it does not take.
 *
 * The superadmin is answered every person, `?q` matching an email or a name and `?state` one of the two states, each
 * given at most once, with the tiles over everybody; the read's coverage begins at the first recorded sign-in. Anybody
 * else is refused before anything is read, with the gateway's sentence, which names nobody.
 */
export function people(who: Me, q: URLSearchParams): [status: number, body: unknown] {
  if (!who.superadmin) return [403, { error: 'not permitted' }];
  if (repeated(q, ['q', 'state', 'limit', 'offset'])) return [400, { error: REPEATED }];
  const state = q.get('state');
  if (state !== null && !STATES.includes(state)) return [400, { error: `state must be one of ${STATES.join(', ')}` }];
  const page = pageOf(q);
  if (typeof page === 'string') return [400, { error: page }];
  const text = (q.get('q') ?? '').trim().toLowerCase();
  // A journey session reads the people it added, last: each was added today, in no team, and has not signed in.
  const everyone = [...PEOPLE, ...(kept()?.added ?? []).map((a): PersonRow => ({
    email: a.email, name: a.name, role: 'member', created: localDay(Date.parse(a.at)), teams: [], passkeys: 0, lastSignIn: null, state: 'active',
  }))];
  const rows = everyone
    .filter((p) => !text || p.email.toLowerCase().includes(text) || p.name.toLowerCase().includes(text))
    .filter((p) => state === null || p.state === state);
  const asOf = iso(now());
  const answer: FixtureAnswer<People> = {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: FIRST_SIGN_IN, to: asOf }, scope: 'platform-admin',
      population: 'people, their passkeys and their recorded console sign-ins', coverageFrom: FIRST_SIGN_IN },
    tiles: {
      people: everyone.length, withPasskey: everyone.filter((p) => p.passkeys > 0).length,
      neverSignedIn: everyone.filter((p) => p.state === 'active' && p.lastSignIn === null).length,
      signInsLastWeek: SIGN_INS_LAST_WEEK,
    },
    people: rows.slice(page.offset, page.offset + page.limit), total: rows.length,
  };
  return [200, answer];
}

/** The team's members as its own page lists them: name, team role and the day they joined. */
export const membersOf = (slug: string) => SEEDS.filter((s) => s.teams.some(([t]) => t === slug)).map((s) => ({
  email: s.email, name: s.name, role: s.teams.find(([t]) => t === slug)![1], state: s.status, joined: day(s.created),
}));

/** `GET /settings/team/members?team=`: one team's roster, for its admins and a superadmin, under `rows`. */
export function teamMembers(slug: string): TeamMembers {
  return { rows: SEEDS.flatMap((s) => s.teams.filter(([t]) => t === slug).map(([, role]) => ({ email: s.email, role, state: s.status }))) };
}
