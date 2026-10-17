/**
 * The fake gateway's teams: what `GET /api/console/teams` and `/teams/:slug` answer.
 *
 * One fixture, the teams as the superadmin reads them: each team and its figures against its own past, the list
 * filtered and paged on the server. Anybody else is refused both reads, as the
 * gateway refuses them.
 *
 * The teams cover the states the pages draw: a team with work and revisions waiting, one with no work at all, an
 * archived one whose calls stopped weeks ago, and more than four with calls, so Usage's split by team has a fourth
 * part. Each team's calls and sessions by week add up to the status fixture's weeks, and its open work and lessons are
 * counted from the work fixture's initiatives and nodes, so every page reads the same platform.
 *
 * COUPLED: zz-stack's `checks/console-platform-teams.ts` imports this file with plain `node` and compares its key sets
 * with the real routes' answers. So nothing here is imported through the console's path alias.
 */
import type { Me } from '../../src/lib/api-shapes.ts';
import type { TeamDetail, TeamRow, Teams } from '../../src/lib/fleet-shapes.ts';
import type { PeriodFigure } from '../../src/lib/platform-shapes.ts';
import { day, now } from './clock.ts';
import { membersOf } from './platform-people.ts';
import { PLATFORM_STATUS } from './platform-status.ts';
import { INITIATIVES, KNOWLEDGE } from './work.ts';

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
/** The status fixture's weeks, oldest first, the running one last. */
const WEEKS = PLATFORM_STATUS.measures.find((m) => m.key === 'malformed_per_1000')!.weeks.map((w) => w.window);
const RUNNING = Date.parse(WEEKS.at(-1)!.from);
const inWeek = (back: number, hours: number) => (back === 0 ? RUNNING + (now() - RUNNING) / 2 : RUNNING - back * 7 * 24 * HOUR + hours * HOUR);

type Seed = {
  slug: string; name: string; status: 'active' | 'archived'; created: number;
  /** Revisions presented and not approved, as `pendingRevisions` counts them. */
  waiting: number;
  /** Real-work calls and distinct sessions by week, oldest first, the running week last. */
  calls: number[]; sessions: number[];
  lastActive: [back: number, hours: number] | null;
};

/* Every week's calls add up to the status fixture's real-work calls (100, 0, 12, 200, 125, 5), atlas's are its own
 * malformed-call denominators, and the sessions add up to its sessions (14, 0, 3, 22, 25, 2). */
const SEEDS: Seed[] = [
  { slug: 'atlas', name: 'Atlas Research', status: 'active', created: 64, waiting: 3,
    calls: [60, 0, 12, 120, 80, 3], sessions: [6, 0, 3, 9, 11, 1], lastActive: [0, 0] },
  { slug: 'beacon', name: 'Beacon Payments', status: 'active', created: 51, waiting: 1,
    calls: [25, 0, 0, 40, 25, 2], sessions: [4, 0, 0, 7, 8, 1], lastActive: [0, 0] },
  { slug: 'cinder', name: 'Cinder Field Operations', status: 'archived', created: 88, waiting: 0,
    calls: [15, 0, 0, 0, 0, 0], sessions: [4, 0, 0, 0, 0, 0], lastActive: [5, 40] },
  { slug: 'dune', name: 'Dune', status: 'active', created: 2, waiting: 0,
    calls: [0, 0, 0, 0, 0, 0], sessions: [0, 0, 0, 0, 0, 0], lastActive: null },
  { slug: 'ember', name: 'Ember Logistics', status: 'active', created: 40, waiting: 0,
    calls: [0, 0, 0, 25, 12, 0], sessions: [0, 0, 0, 4, 4, 0], lastActive: [1, 30] },
  { slug: 'fjord', name: 'Fjord Analytics', status: 'active', created: 35, waiting: 0,
    calls: [0, 0, 0, 15, 8, 0], sessions: [0, 0, 0, 2, 2, 0], lastActive: [1, 70] },
];

/** A count in one week, which stands at any size: a zero is a week that was read and held none. */
const tally = (i: number, n: number): PeriodFigure => ({ window: WEEKS[i], figure: { value: n, why: null }, numerator: n, denominator: null });
const LAST = WEEKS.length - 2;

/** Every team's calls by week, oldest first, for the reads that split calls by team. */
export const CALLS_BY_TEAM: { team: string; calls: number[] }[] = SEEDS.map((s) => ({ team: s.slug, calls: s.calls }));

/**
 * Every team as the superadmin's list reads it, in the gateway's order: the latest real-work call first, a team with
 * none last, the slug breaking a tie. Mutable, as today: the live check's `__hint` renames a team in place.
 */
export const TEAMS: TeamRow[] = SEEDS.map((s) => ({
  slug: s.slug, name: s.name, status: s.status, created: day(s.created),
  people: membersOf(s.slug).length,
  openWork: INITIATIVES.filter((i) => i.team === s.slug && !i.closed).length,
  waiting: s.waiting,
  lessons: KNOWLEDGE.filter((n) => n.team === s.slug && n.status === 'adopted').length,
  sessions: s.sessions.map((n, i) => tally(i, n)),
  calls: { last: tally(LAST, s.calls[LAST]), previous: tally(LAST - 1, s.calls[LAST - 1]) },
  lastActive: s.lastActive === null ? null : iso(inWeek(...s.lastActive)),
})).sort((a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? '') || a.slug.localeCompare(b.slug));

/** The gateway's refusal to anybody but the superadmin, made before anything is read: it names nobody and says nothing
 *  of whether the team asked for exists. */
const REFUSED: [number, unknown] = [403, { error: 'not permitted' }];

const meta = (population: string) => {
  const asOf = iso(now());
  return { ...PLATFORM_STATUS.meta, asOf, period: { from: WEEKS[0].from, to: asOf }, scope: 'platform-admin' as const, population };
};

const STATUSES = ['active', 'archived'];

/**
 * `GET /teams`, as `who`, on `page`; null when the superadmin asked for a page the read does not take.
 *
 * The superadmin is answered every team, `?q` matching a slug or a name and `?status` one of the two states, each
 * given at most once, with the tiles over every team. Anybody else is refused, whatever they asked.
 */
export function teams(who: Me, q: URLSearchParams, page: { limit: number; offset: number } | null): [status: number, body: unknown] | null {
  if (!who.superadmin) return REFUSED;
  if (!page) return null;
  if (q.getAll('q').length > 1 || q.getAll('status').length > 1) return [400, { error: 'each filter and the page are given at most once' }];
  const status = q.get('status');
  if (status !== null && !STATUSES.includes(status)) return [400, { error: `status must be one of ${STATUSES.join(', ')}` }];
  const text = (q.get('q') ?? '').trim().toLowerCase();
  const rows = TEAMS
    .filter((t) => !text || t.slug.includes(text) || t.name.toLowerCase().includes(text))
    .filter((t) => status === null || t.status === status);
  const sum = (of: (t: TeamRow) => number) => TEAMS.reduce((n, t) => n + of(t), 0);
  const answer: Teams = {
    meta: meta('teams, their members, open work, revisions waiting, standing lessons and real-work tool calls'),
    tiles: { teams: TEAMS.length, openWork: sum((t) => t.openWork), pending: sum((t) => t.waiting), lessons: sum((t) => t.lessons) },
    teams: rows.slice(page.offset, page.offset + page.limit).map((t) => ({ ...t })), total: rows.length,
  };
  return [200, answer];
}

/** One team as the superadmin's page reads it: the team, its members, its row's tiles and its calls by week. Null for a
 *  slug no team has. */
export function teamDetail(slug: string): TeamDetail | null {
  const t = TEAMS.find((x) => x.slug === slug);
  if (!t) return null;
  const seed = SEEDS.find((s) => s.slug === slug)!;
  return {
    team: { slug: t.slug, name: t.name, status: t.status, created: t.created },
    members: membersOf(slug),
    meta: meta(`${t.slug}'s members, open work, revisions waiting, standing lessons and real-work tool calls`),
    tiles: { people: t.people, openWork: t.openWork, waiting: t.waiting, lessons: t.lessons },
    calls: seed.calls.map((n, i) => tally(i, n)),
  };
}

/**
 * `GET /teams/:slug`, as `who`. The superadmin is answered any team, and a slug no team has is 404 with nothing in it.
 * Anybody else is refused, their own team as much as one that does not exist.
 */
export function team(who: Me, slug: string): [status: number, body: unknown] {
  if (!who.superadmin) return REFUSED;
  const detail = teamDetail(slug);
  return detail ? [200, detail] : [404, null];
}
