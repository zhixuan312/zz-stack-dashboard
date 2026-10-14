/**
 * The fake gateway's people: what `GET /api/console/people` answers, and the platform's and a team's rosters under
 * `/settings`.
 *
 * Synthetic on purpose, as people.ts says: every address is under `example.com`. One fixture, the people as the
 * superadmin reads them; a member's answer is derived from it. The superadmin reads every person with their passkeys,
 * their last recorded sign-in and their state, filtered and paged on the server; a member is still answered today's
 * roster of their own team, each person's teams narrowed to it, until the console's grants turn that into the
 * gateway's refusal.
 *
 * The cast covers the states the page draws: a person who never signed in, a deactivated one with sign-ins before,
 * a superadmin in no team of the others, a person in two teams, and a name long enough to wrap.
 *
 * COUPLED: zz-stack's `checks/console-platform-people.ts` imports this file with plain `node` and compares its key sets
 * with the real route's answer. So nothing here is imported through the console's path alias.
 */
import type { Me, Person, PlatformPersonRow, TeamMemberRow } from '../../src/lib/api-shapes.ts';
import type { People, PersonRow } from '../../src/lib/fleet-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { ago, day, now } from './clock.ts';
import { ME, MEMBER } from './people.ts';
import { PLATFORM_STATUS } from './platform-status.ts';

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** The status fixture's weeks, oldest first, the running one last: every Fleet read counts in the same weeks. */
const WEEKS = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.weeks.map((w) => w.window);
const RUNNING = Date.parse(WEEKS.at(-1)!.from);

/** An instant `hours` into the week `back` weeks before the running one; in the running week, halfway to now, so it
 *  has always happened whatever day verify runs on. */
const inWeek = (back: number, hours: number) => (back === 0 ? RUNNING + (now() - RUNNING) / 2 : RUNNING - back * 7 * 24 * HOUR + hours * HOUR);

type Seed = {
  email: string; name: string; role: 'superadmin' | 'member'; status: 'active' | 'deactivated'; created: number;
  teams: [string, 'admin' | 'member'][]; active: string | null; tokens: number; lastUsed: number | null;
  passkeys: number; signIns: [back: number, hours: number][];
};

const SEEDS: Seed[] = [
  { email: ME.email, name: ME.name, role: 'superadmin', status: 'active', created: 88, teams: [['atlas', 'admin'], ['beacon', 'member']], active: 'atlas', tokens: 3, lastUsed: 0.2,
    passkeys: 2, signIns: [[0, 0], [1, 10], [1, 58], [2, 30]] },
  { email: MEMBER.email, name: MEMBER.name, role: 'member', status: 'active', created: 64, teams: [['atlas', 'admin']], active: 'atlas', tokens: 2, lastUsed: 3,
    passkeys: 1, signIns: [[1, 20], [3, 4]] },
  { email: 'mei.tanaka@example.com', name: 'Mei Tanaka', role: 'member', status: 'active', created: 60, teams: [['atlas', 'member'], ['beacon', 'member']], active: 'beacon', tokens: 1, lastUsed: 26,
    passkeys: 1, signIns: [[2, 30]] },
  { email: 'jonas.weber@example.com', name: 'Jonas Weber', role: 'member', status: 'active', created: 51, teams: [['beacon', 'admin']], active: 'beacon', tokens: 2, lastUsed: 7,
    passkeys: 1, signIns: [[1, 50], [4, 70]] },
  { email: 'maximiliana.fitzgerald-oyelaran@example.com', name: 'Maximiliana Fitzgerald-Oyelaran Kowalczyk', role: 'member', status: 'active', created: 40, teams: [['atlas', 'member']], active: 'atlas', tokens: 0, lastUsed: null,
    passkeys: 0, signIns: [] },
  { email: 'leo.santos@example.com', name: 'Leo Santos', role: 'member', status: 'deactivated', created: 88, teams: [['cinder', 'admin']], active: null, tokens: 0, lastUsed: 1100,
    passkeys: 1, signIns: [[5, 3]] },
  { email: 'sam.reyes@example.com', name: 'Sam Reyes', role: 'superadmin', status: 'active', created: 30, teams: [['dune', 'admin']], active: 'dune', tokens: 1, lastUsed: 49,
    passkeys: 1, signIns: [[1, 90]] },
  { email: 'iris.moreau@example.com', name: 'Iris Moreau', role: 'member', status: 'active', created: 40, teams: [['ember', 'admin']], active: 'ember', tokens: 1, lastUsed: 30,
    passkeys: 1, signIns: [[1, 8]] },
  { email: 'kofi.mensah@example.com', name: 'Kofi Mensah', role: 'member', status: 'active', created: 35, teams: [['fjord', 'admin'], ['ember', 'member']], active: 'fjord', tokens: 2, lastUsed: 60,
    passkeys: 1, signIns: [[2, 12]] },
];

/** Every person as the superadmin's list reads them, in the gateway's order: by the day they were added, then email. */
export const PEOPLE: PersonRow[] = SEEDS.map((s) => {
  const signIns = s.signIns.map(([back, hours]) => inWeek(back, hours));
  return {
    email: s.email, name: s.name, role: s.role, status: s.status, created: day(s.created),
    active_team: s.active ?? '', activeTeam: s.active, teams: s.teams.map(([t, r]) => `${t} (${r})`), tokens: s.tokens,
    last_used: s.lastUsed === null ? null : ago(s.lastUsed),
    passkeys: s.passkeys, lastSignIn: signIns.length ? iso(Math.max(...signIns)) : null, state: s.status,
  };
}).sort((a, b) => a.created.localeCompare(b.created) || a.email.localeCompare(b.email));

/** A person as today's `/people` answered them, before passkeys and sign-ins. */
const asToday = (p: PersonRow): Person => ({
  email: p.email, name: p.name, role: p.role, status: p.status, created: p.created, activeTeam: p.activeTeam, teams: p.teams,
  tokens: p.tokens, last_used: p.last_used,
});

/** One team's people as a member of it is answered: the same rows, and nothing in one names another team. */
export function rosterOf(team: string): Person[] {
  const here = (t: string) => t.startsWith(`${team} `);
  return PEOPLE.filter((p) => p.teams.some(here)).map((p) => ({ ...asToday(p), activeTeam: p.activeTeam === team ? team : null, teams: p.teams.filter(here) }));
}

/** The first recorded sign-in, where the gateway says its record of them begins. */
const FIRST_SIGN_IN = iso(Math.min(...SEEDS.flatMap((s) => s.signIns.map(([back, hours]) => inWeek(back, hours)))));

/** The recorded sign-ins in the last complete week, every person's. */
const SIGN_INS_LAST_WEEK: PeriodFigure = (() => {
  const n = SEEDS.reduce((sum, s) => sum + s.signIns.filter(([back]) => back === 1).length, 0);
  return { window: WEEKS.at(-2)!, figure: { value: n, why: null }, numerator: n, denominator: null };
})();

const STATES = ['active', 'deactivated'];

/**
 * `GET /people`, as `who`, on `page`; null when the superadmin asked for a page the read does not take.
 *
 * The superadmin is answered every person, `?q` matching an email or a name and `?state` one of the two states, each
 * given at most once, with the tiles over everybody; the read's coverage begins at the first recorded sign-in. A member is answered as today: their own team's roster, or nothing for a person in no team.
 */
export function people(who: Me, q: URLSearchParams, page: { limit: number; offset: number } | null): [status: number, body: unknown] | null {
  if (!who.superadmin) return [200, { people: who.activeTeam ? rosterOf(who.activeTeam) : [] }];
  if (!page) return null;
  if (q.getAll('q').length > 1 || q.getAll('state').length > 1) return [400, { error: 'each filter and the page are given at most once' }];
  const state = q.get('state');
  if (state !== null && !STATES.includes(state)) return [400, { error: `state must be one of ${STATES.join(', ')}` }];
  const text = (q.get('q') ?? '').trim().toLowerCase();
  const rows = PEOPLE
    .filter((p) => !text || p.email.toLowerCase().includes(text) || p.name.toLowerCase().includes(text))
    .filter((p) => state === null || p.state === state);
  const asOf = iso(now());
  const answer: People = {
    meta: { ...PLATFORM_STATUS.meta, asOf, period: { from: FIRST_SIGN_IN, to: asOf }, scope: 'platform-admin',
      population: 'people, their passkeys and their recorded console sign-ins', coverageFrom: FIRST_SIGN_IN },
    tiles: {
      people: PEOPLE.length, withPasskey: PEOPLE.filter((p) => p.passkeys > 0).length,
      neverSignedIn: PEOPLE.filter((p) => p.state === 'active' && p.lastSignIn === null).length,
      signInsLastWeek: SIGN_INS_LAST_WEEK,
    },
    people: rows.slice(page.offset, page.offset + page.limit), total: rows.length,
  };
  return [200, answer];
}

/** The team's members as its own page lists them: name, team role and the day they joined. */
export const membersOf = (slug: string) => SEEDS.filter((s) => s.teams.some(([t]) => t === slug)).map((s) => ({
  email: s.email, name: s.name, role: s.teams.find(([t]) => t === slug)![1], joined: day(s.created),
}));

/** `GET /settings/platform/people`: every principal, the superadmin's. */
export const PLATFORM_PEOPLE: PlatformPersonRow[] = SEEDS.map((s) => ({
  email: s.email, display_name: s.name, role: s.role, status: s.status, created_at: ago(s.created * 24),
  teams: s.teams.map(([team, role]) => ({ team, role, added_by: s.email === ME.email ? null : ME.email, added_at: ago(s.created * 24 - 1) })),
}));

/** `GET /settings/team/members?team=`: one team's roster, for its admins and a superadmin. */
export function teamMembers(slug: string): TeamMemberRow[] {
  return SEEDS.flatMap((s) => s.teams.filter(([t]) => t === slug).map(([, role]) => ({ email: s.email, role })));
}
