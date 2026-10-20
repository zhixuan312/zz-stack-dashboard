// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail, InitiativeDetail, KnowledgeBody, KnowledgeLog, KnowledgeLogEntry, PluginEval } from '../src/lib/api-shapes.ts';
import type { ActivityLog, ActivitySummary, KnowledgeList, KnowledgeSummary, Runs } from '../src/lib/destination-shapes.ts';
import type { Audit, KnowledgeHealth, People, TeamDetail, Teams, Usage } from '../src/lib/fleet-shapes.ts';
import type { Bugs, Evaluation, PlatformStatus, Releases, Window } from '../src/lib/platform-shapes.ts';
import type { Approvals, Home, InitiativeList, RecordRead } from '../src/lib/work-shapes.ts';
import { now } from '../scripts/fake-gateway/clock.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people as peopleAnswer } from '../scripts/fake-gateway/platform-people.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { NULL_STANDIN } from '../scripts/fake-gateway/states-partial.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { initiativeDetail, initiativeList, rowsOf } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeList, knowledgeSummary, logOf } from '../scripts/fake-gateway/work-knowledge.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';
import config from '../scripts/verify.config.ts';

/** The console server's cookie jar, for its own read of the gateway (`gatewayGet`): the session value a test names. */
const jar = vi.hoisted(() => ({ value: '' }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => (name === 'zz_console' && jar.value ? { value: jar.value } : undefined) }) }));
const { gatewayGet } = await import('../src/data/gateway.ts');

/**
 * The fixture's own modes, which are what every state the console draws is checked against.
 *
 * `pnpm verify` runs `normal` only, so a mode that throws is a mode nothing notices — and this one
 * threw out of the request handler and killed the gateway process: every page after it reported
 * "cannot reach the platform", and the shape that caused it was the only thing the report did not
 * show. A transform reads an answer by its own idea of that route's shape, so a route that grows a
 * second answer is where it will break next.
 */
/** The initiatives list as the fixture answers the superadmin for `query`. */
const LIST = (query = ''): InitiativeList => initiativeList(ME, new URLSearchParams(query))[1] as InitiativeList;
/** A list a team with no work is answered. */
const NONE = (): InitiativeList => ({ ...LIST(), rows: [], total: 0 });
/** Each of Work's other answers, as the fixture gives the superadmin. */
const body = <T,>(answer: [number, unknown]): T => answer[1] as T;
const SHELF = () => body<KnowledgeList>(knowledgeList(ME, new URLSearchParams()));
const LEARNED = () => body<KnowledgeSummary>(knowledgeSummary(ME));
const SUMMARY = () => body<ActivitySummary>(activitySummary(ME));
const LOG = () => body<ActivityLog>(activityLog(ME, new URLSearchParams()));
const RUNS = () => body<Runs>(runs(ME, new URLSearchParams()));
/** Teams as the fixture answers the superadmin, one page of ten, and the same list with no team in it. */
const TEAMS = () => body<Teams>(teams(ME, new URLSearchParams(), { limit: 10, offset: 0 })!);
const NO_TEAMS = (): Teams => ({ ...TEAMS(), teams: [], total: 0 });
/** People as the fixture answers the superadmin, one page of ten, and the same list with nobody matching. */
const PEOPLE_LIST = () => body<People>(peopleAnswer(ME, new URLSearchParams(), { limit: 10, offset: 0 })!);
const NOBODY = (): People => ({ ...PEOPLE_LIST(), people: [], total: 0 });
describe('the fixture can shape every answer its routes produce', () => {
  it('leaves an empty list empty rather than inventing rows it cannot shape', () => {
    // `/initiatives?team=<a team with no work>` is empty, and it is a state the console draws. A
    // mode that filled it in grew its rows from `rows[i % 0]` — `undefined` — so every fabricated
    // row carried the slug below and none of the fields an initiative has. The page's columns
    // dereference `stages`, and /teams/dune died in its error boundary on the whole page.
    const none = NONE();
    expect((extreme(['initiatives'], none) as InitiativeList)).toMatchObject({ rows: [], total: 0 });
    expect(extreme(['teams'], NO_TEAMS())).toMatchObject({ teams: [], total: 0 });
    expect(extreme(['people'], NOBODY())).toMatchObject({ people: [], total: 0 });
    expect(extreme(['knowledge'], { ...SHELF(), rows: [], total: 0 })).toMatchObject({ rows: [], total: 0 });
    expect(extreme(['activity'], { ...LOG(), rows: [], total: 0 })).toMatchObject({ rows: [], total: 0 });
  });

  it('makes a busy list a page of long names under large counts, never more rows than the page asked for', () => {
    // The list is paged on the server, so however busy the team, a page holds what it asked for.
    const list = LIST();
    const got = extreme(['initiatives'], list) as InitiativeList;
    expect(got.rows).toHaveLength(list.rows.length);
    expect(got.total).toBeGreaterThan(1_000);
    expect(got.summary.state === 'ok' && got.summary.data.total).toBe(got.total);
    for (const [i, row] of got.rows.entries()) {
      expect(Object.keys(row).sort(), `a row lost a field: ${JSON.stringify(row)}`).toEqual(Object.keys(list.rows[i]).sort());
      expect(row.slug.length).toBeGreaterThan(60);
    }
  });

  it('shapes every answer the routes actually produce, empty lists included', () => {
    // Each route paired with the answers `read()` gives it — the property that matters: a shape a
    // route really produces must not be a shape this mode does not know. The server catches what is
    // left out, so an unrecognised answer is served as it is rather than taking the gateway down;
    // that is a backstop, not the contract.
    const answers: [string[], unknown][] = [
      [['home'], homeOf('atlas', ME.email)],
      [['approvals'], body(approvals(ME, new URLSearchParams()))],
      [['initiatives'], LIST()],
      [['initiatives'], NONE()],
      [['knowledge'], SHELF()],
      [['knowledge', 'summary'], LEARNED()],
      [['knowledge', 'log'], logOf([])],
      [['activity'], LOG()],
      [['activity', 'summary'], SUMMARY()],
      [['runs'], RUNS()],
      [['plugins'], body(plugins(ME))],
      [['access'], body(access(ME))],
      [['teams'], TEAMS()],
      [['teams'], NO_TEAMS()],
      [['teams', 'atlas'], teamDetail('atlas')],
      [['people'], PEOPLE_LIST()],
      [['people'], NOBODY()],
      [['platform', 'status'], PLATFORM_STATUS],
      [['unknown-head'], { anything: true }],
      [[], {}],
    ];
    for (const [seg, body] of answers) {
      expect(() => extreme(seg, body), `extreme(${JSON.stringify(seg)}) threw`).not.toThrow();
      expect(() => empty(seg, body), `empty(${JSON.stringify(seg)}) threw`).not.toThrow();
    }
  });

  it('makes busy teams a full page of long names under large counts, and a fresh platform none at all', () => {
    // Teams is paged and counted on the server, as Initiatives is: a page holds what it asked for, and the tiles and
    // the total are every team's, never the page's.
    const list = TEAMS();
    const busy = extreme(['teams'], list) as Teams;
    // The page asked for ten, and a busy platform has them all, though the fixture holds fewer.
    expect(busy.teams).toHaveLength(10);
    expect(busy.total).toBeGreaterThan(100);
    expect(busy.tiles.teams).toBe(busy.total);
    for (const [i, row] of busy.teams.entries()) {
      expect(Object.keys(row).sort(), `a row lost a field: ${JSON.stringify(row)}`).toEqual(Object.keys(list.teams[i % list.teams.length]).sort());
      expect(row.name.length).toBeGreaterThan(60);
    }
    expect(empty(['teams'], list)).toMatchObject({ teams: [], total: 0, tiles: { teams: 0, openWork: 0, pending: 0, lessons: 0 } });
    // One team's page is its own record however busy the platform, and on a fresh deployment a team with nobody in it.
    expect(extreme(['teams', 'atlas'], teamDetail('atlas'))).toEqual(teamDetail('atlas'));
    expect(empty(['teams', 'atlas'], teamDetail('atlas'))).toEqual({ ...teamDetail('atlas'), members: [], tiles: { people: 0, openWork: 0, waiting: 0, lessons: 0 }, calls: [] });
  });

  it('empties Home as it empties the list: nothing waits, nothing is open, and no week holds a recorded value', () => {
    const home = empty(['home'], homeOf('atlas', ME.email)) as Home;
    expect(home.title).toEqual({ sentence: 'Your work at a glance', rule: 'fallback' });
    expect(home.waiting).toEqual({ state: 'ok', data: { count: 0, oldestSince: null, one: null } });
    expect(home.openWork).toEqual({ state: 'ok', data: { rows: [], quiet: 0, total: 0 } });
    expect(home.words.state === 'ok' && home.words.data.weeks.every((w) => w.figure.value === null)).toBe(true);
    const list = empty(['initiatives'], LIST()) as InitiativeList;
    expect(list).toMatchObject({ rows: [], total: 0, tiles: { open: 0, waiting: 0, closed: { accepted: 0, delivered: 0, abandoned: 0 } } });
    expect(list.summary.state === 'ok' && list.summary.data.total).toBe(0);
    const queue = empty(['approvals'], body(approvals(ME, new URLSearchParams()))) as Approvals;
    expect(queue.tiles).toEqual({ waiting: 0, oldestWaitingSince: null, inYourName: 0, noPresentation: { count: 0, of: 0 } });
    expect(queue.weeks).toEqual([]);
    expect(queue.waiting).toMatchObject({ state: 'ok', data: { rows: [], total: 0, summary: { olderThan14Days: 0 } } });
    expect(queue.history).toMatchObject({ state: 'ok', data: { rows: [], total: 0, summary: { byInitiative: [] } } });
  });

  // An initiative with nothing written waits on no gate, and was last touched when it opened, or when it closed: the
  // list's own rule, with no document in it, and never its real row's state over emptied documents and gates.
  it('empties an initiative\'s page to one opened and never written, in the list\'s words for that', () => {
    for (const slug of ['2026-09-28-search-relevance', '2026-10-03-ranking-weights', '2026-09-12-onboarding-revamp']) {
      const row = rowsOf('atlas').find((r) => r.slug === slug)!;
      const page = empty(['initiatives', 'atlas', slug], initiativeDetail('atlas', slug)) as InitiativeDetail;
      expect(page, slug).toMatchObject({ documents: [], gates: [], steps: [] });
      expect(page.lastTouched, slug).toBe(row.closed ?? row.opened);
      expect(page.state, slug).toBe(row.closed ? row.state : now() - Date.parse(row.opened) >= 14 * 86_400_000 ? 'quiet' : 'open');
    }
  });

  it('keeps Work\'s other pages to their page, and their counts to their sums, however busy', () => {
    for (const [seg, answer, rows] of [
      [['knowledge'], SHELF(), (b: KnowledgeList) => b.rows],
      [['activity'], LOG(), (b: ActivityLog) => b.rows],
      [['runs'], RUNS(), (b: Runs) => (b.recent.state === 'ok' ? b.recent.data.rows : [])],
    ] as [string[], unknown, (b: never) => unknown[]][]) {
      const got = extreme(seg, answer);
      expect(rows(got as never), seg.join('/')).toHaveLength(rows(answer as never).length);
      expect(Object.keys(got as object).sort(), seg.join('/')).toEqual(Object.keys(answer as object).sort());
    }
    const busy = extreme(['activity', 'summary'], SUMMARY()) as ActivitySummary;
    for (const w of busy.weeks.state === 'ok' ? busy.weeks.data : []) expect(Object.values(w.owners).reduce((a, b) => a + b, 0)).toBe(w.refused);
    // A fresh deployment's: nothing counted, nothing listed, every week read and holding none.
    const fresh = empty(['activity', 'summary'], SUMMARY()) as ActivitySummary;
    expect(fresh.tiles.refused.owners).toEqual({ state: 'ok', data: { guardrail: 0, ours: 0, theirs: 0, other: 0 } });
    expect(fresh.tiles.mostRefused).toEqual({ state: 'ok', data: null });
    expect(empty(['runs'], RUNS())).toMatchObject({ since: null, tiles: { largest: null, outputPerRun: { value: null } } });
    expect(empty(['knowledge', 'summary'], LEARNED())).toMatchObject({ questions: { state: 'ok', data: { rows: [], total: 0 } } });
  });

  it('keeps the platform\'s status week for week on a busy platform, and as a fresh deployment answers it to an empty one', () => {
    // A busy platform needs more of somebody (below); its weeks and its doors are the fixture's.
    const busy = extreme(['platform', 'status'], PLATFORM_STATUS) as typeof PLATFORM_STATUS;
    expect({ ...busy, needs: null }).toEqual({ ...PLATFORM_STATUS, needs: null });
    // A fresh deployment: every check answered and nothing found, every week read and holding no data, no door's day.
    // The shape stays the fixture's, week for week, so a page meets nothing the gateway never sends.
    const fresh = empty(['platform', 'status'], PLATFORM_STATUS) as typeof PLATFORM_STATUS;
    expect(fresh.needs).toMatchObject({ state: 'complete', rows: [], total: 0 });
    expect(fresh.measures.map((m) => m.key)).toEqual(PLATFORM_STATUS.measures.map((m) => m.key));
    for (const [i, m] of fresh.measures.entries()) {
      expect(m.weeks).toHaveLength(PLATFORM_STATUS.measures[i].weeks.length);
      expect(m.weeks.every((w) => w.figure.value === null && w.figure.why === 'no_data')).toBe(true);
    }
    expect(fresh.doors).toEqual({ state: 'ok', data: [] });
    expect(PLATFORM_STATUS.needs.rows.length).toBeGreaterThan(0);
  });
});

describe('People in the other worlds', () => {
  it('is nobody on a fresh deployment: every tile zero and the week before the record of sign-ins', () => {
    const got = empty(['people'], PEOPLE_LIST()) as People;
    expect(got).toMatchObject({ people: [], total: 0, tiles: { people: 0, withPasskey: 0, neverSignedIn: 0 } });
    expect(got.tiles.signInsLastWeek.figure).toEqual({ value: null, why: 'no_data' });
    expect(got.tiles.signInsLastWeek.window).toEqual({ ...PEOPLE_LIST().tiles.signInsLastWeek.window, observedFrom: null, observedThrough: null, complete: false });
  });

  it('is a page of long names under large counts on a busy platform, as many rows as the page asked for', () => {
    const list = PEOPLE_LIST();
    const got = extreme(['people'], list) as People;
    expect(got.people).toHaveLength(10);
    expect(got.total).toBeGreaterThan(100);
    expect(got.tiles.people).toBe(got.total);
    for (const [i, row] of got.people.entries()) {
      expect(Object.keys(row).sort(), `a row lost a field: ${JSON.stringify(row)}`).toEqual(Object.keys(list.people[i % list.people.length]).sort());
      expect(row.name.length).toBeGreaterThan(60);
      expect(row.teams.length).toBeGreaterThan(1);
    }
  });
});

describe('a busy platform is still one team to a member', () => {
  const entry: KnowledgeLogEntry = { ts: '2026-10-05T00:00:00Z', actor: 'a@example.com', team: 'beacon', kind: 'knowledge.add', node: '0001', recorded_title: 't', superseded_by: null, node_title: 't', node_status: 'adopted', path: null };

  it('grows no team beside their own', () => {
    // The gateway refuses a member Teams, so this answer is never theirs; held to a team, it is left as it is.
    expect(extreme(['teams'], TEAMS(), 'atlas')).toEqual(TEAMS());
  });

  it('grows no person, and log entries that name their team and no other', () => {
    // The gateway refuses a member People, so this answer is never theirs; held to a team, it is left as it is.
    expect(extreme(['people'], PEOPLE_LIST(), 'atlas')).toEqual(PEOPLE_LIST());

    const log = extreme(['knowledge', 'log'], logOf([entry]), 'beacon') as KnowledgeLog;
    // Past the gateway's ceiling: the latest 500 answered, every entry counted.
    expect(log.entries).toHaveLength(log.ceiling);
    expect(log.totals.entries).toBeGreaterThan(log.ceiling);
    for (const e of log.entries) expect(e.team).toBe('beacon');
  });
});

/**
 * The five modes as a SERVER, for each of the two people it answers as: a mode that worked for the superadmin and
 * broke, or widened, for the member is a mode nobody sweeping by hand would be told about.
 */
describe('every mode answers both people', () => {
  type Me = { role: string; activeTeam: string };
  const servers: ChildProcess[] = [];
  afterEach(() => { for (const p of servers.splice(0)) p.kill(); });

  /** Start the fixture in one mode and wait for the address it prints. */
  async function start(mode: string): Promise<string> {
    const gateway = await startFakeGateway('--mode', mode);
    servers.push(gateway.proc);
    return gateway.base;
  }

  /** Each person by the cookie `pnpm verify --as` sends for them; the superadmin also as the default run asks, with none. */
  const PEOPLE: [name: string, role: string, cookie: string | null][] = [
    ['no cookie', 'superadmin', null],
    ['superadmin', 'superadmin', config.personas!.superadmin.cookie.value],
    ['member', 'member', config.personas!.member.cookie.value],
  ];
  const ask = (base: string, cookie: string | null, path: string, ms = 10_000) =>
    fetch(`${base}/api/console/${path}`, { headers: cookie === null ? {} : { cookie: `zz_console=${cookie}` }, signal: AbortSignal.timeout(ms) });
  const READS = ['initiatives', 'knowledge', 'knowledge/summary', 'knowledge/log', 'activity',
                 'activity/summary', 'runs', 'plugins', 'skills', 'access', 'settings/me/tokens', 'settings/me/teams', 'platform/status',
                 'home', 'record', 'approvals', 'work/query?measure=closures&by=outcome',
                 'platform/query?measure=calls&by=week'];
  /** The superadmin's alone: a member is refused them in every world. */
  const FLEET = ['teams', 'teams?scope=platform', 'teams/atlas', 'people', 'people?scope=platform', 'platform/audit'];
  const REFUSAL = { error: 'not permitted' };

  /** Every list a rail page reads, as the rows it answers; Teams and People only to the superadmin, who may read them. */
  async function lists(base: string, cookie: string | null, superadmin: boolean) {
    const get = async (path: string) => (await ask(base, cookie, path)).json() as Promise<Record<string, { team: string; teams: string[] }[]>>;
    return {
      teams: superadmin ? (await get('teams?scope=platform&limit=100')).teams : [],
      people: superadmin ? (await get('people?scope=platform&limit=100')).people : [],
      initiatives: (await get('initiatives?scope=platform&limit=100')).rows,
      byTeam: [
        ...(await get('knowledge?scope=platform&limit=100')).rows, ...(await get('knowledge/log?scope=platform')).entries,
      ],
    };
  }

  it.each(['normal', 'empty', 'extreme'])('%s: every read answers, and the member is held to their own team and refused the fleet', async (mode) => {
    const base = await start(mode);
    for (const [name, role, cookie] of PEOPLE) {
      const me = await (await ask(base, cookie, 'me')).json() as Me;
      expect(me.role, name).toBe(role);
      for (const path of READS) expect((await ask(base, cookie, path)).status, `${mode}, ${name}: GET ${path}`).toBe(200);
      for (const path of FLEET) {
        const res = await ask(base, cookie, path);
        if (role === 'member') expect([res.status, await res.json()], `${mode}, ${name}: GET ${path}`).toEqual([403, REFUSAL]);
        else expect(res.status, `${mode}, ${name}: GET ${path}`).toBe(200);
      }

      const { teams, people, initiatives, byTeam } = await lists(base, cookie, role === 'superadmin');
      if (mode === 'empty') expect([teams, people, initiatives, byTeam], name).toEqual([[], [], [], []]);
      else {
        // Knowledge and its log are Work's, the active team's for the superadmin too, whatever scope is asked for.
        expect(byTeam.length, name).toBeGreaterThan(role === 'member' ? 10 : 0);
        for (const row of byTeam) expect(row.team, JSON.stringify(row).slice(0, 120)).toBe(me.activeTeam);
        // Teams is paged by the gateway, so a busy platform is still a page of the teams asked for.
        if (role === 'superadmin') expect(teams.length, name).toBeGreaterThan(3);
      }
    }
    // The status is one public answer in every world, but for what needs attention, which a member reads in their
    // projection, and the scope it is labelled with: the superadmin's platform-admin, a member's platform-public (R1-C16).
    const status = await Promise.all(PEOPLE.map(async ([, , cookie]) => (await (await ask(base, cookie, 'platform/status')).json()) as { meta: { scope: string } }));
    expect(status.map((s) => s.meta.scope)).toEqual(['platform-admin', 'platform-admin', 'platform-public']);
    const alike = status.map((s) => ({ ...s, meta: { ...s.meta, scope: null }, needs: null }));
    expect(alike[1]).toEqual(alike[0]);
    expect(alike[2]).toEqual(alike[0]);
  });

  it('error: every read but /me fails for both, and neither is sent to sign in', async () => {
    const base = await start('error');
    for (const [name, role, cookie] of PEOPLE) {
      const me = await ask(base, cookie, 'me');
      expect(me.status, name).toBe(200);
      expect((await me.json() as Me).role, name).toBe(role);
      for (const path of ['teams', 'initiatives', 'people', 'settings/me/tokens']) expect((await ask(base, cookie, path)).status, `${name}: GET ${path}`).toBe(503);
    }
  });

  it('slow: a page read is held past every read bound for both, and who is asking is answered at once', async () => {
    const base = await start('slow');
    await Promise.all(PEOPLE.map(async ([name, role, cookie]) => {
      expect((await (await ask(base, cookie, 'me', 1000)).json() as Me).role, name).toBe(role);
      const quickly = await ask(base, cookie, 'home', 1000).then(() => 'answered', (e: Error) => e.name);
      expect(quickly, name).toBe('TimeoutError');
      expect((await ask(base, cookie, 'home', 8000)).status, name).toBe(200);
    }));
  }, 20_000);
});

/**
 * A state per request (reconciliation 79): the session value `<person>+<state>` draws that state for that request alone,
 * so a sweep of every state runs beside the suites reading the normal one against one process. Every console read
 * forwards the value: the browser's through the app's rewrite, with its other cookies and the page as the Referer, and
 * the server's through `src/data/gateway.ts`, which copies the one cookie and asks `scope=platform`.
 */
describe('a state asked for by the session value', () => {
  const servers: ChildProcess[] = [];
  afterEach(() => { for (const p of servers.splice(0)) p.kill(); delete process.env.ZZ_GATEWAY; jar.value = ''; });
  async function start(): Promise<string> {
    const gateway = await startFakeGateway();
    servers.push(gateway.proc);
    return gateway.base;
  }

  const NODE = 'knowledge/atlas/nodes/0002-match-reasons-come-from-the-index-never-from-a-model.md';
  /** Every route a page reads, the detail routes among them, as both people; the fleet's to the superadmin alone. */
  const ROUTES = [
    'me', 'home', 'record', 'approvals', 'initiatives', 'initiatives/atlas/2026-09-28-search-relevance',
    'document/atlas/2026-09-28-search-relevance/spec.md', 'knowledge', 'knowledge/summary', 'knowledge/log', NODE,
    'activity', 'activity/summary', 'runs', 'plugins', 'skills?plugin=sdlc', 'skills/sdlc-spec', 'plugins/sdlc/skills/sdlc-spec',
    'access', 'settings/me/teams', 'platform/status', 'platform/releases', 'platform/releases/0.97.0', 'platform/bugs',
    'platform/evaluation', 'platform/usage', 'platform/knowledge', 'work/query?measure=closures&by=outcome',
  ];
  const FLEET = ['teams', 'teams/atlas', 'people', 'platform/audit', 'plugins/sdlc/eval', 'platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01'];
  const routesOf = (person: string) => (person === 'superadmin' ? [...ROUTES, ...FLEET] : ROUTES);
  const own = (path: string) => path === 'me' || path.startsWith('search');
  const scoped = (path: string) => (own(path) ? path : `${path}${path.includes('?') ? '&' : '?'}scope=platform`);

  /** One read as the console's server makes it, or as the browser does through the app's rewrite. */
  async function read(base: string, value: string, path: string, from: 'server' | 'browser' = 'server'): Promise<[number, unknown]> {
    const headers: Record<string, string> = from === 'server'
      ? { accept: 'application/json', cookie: `zz_console=${value}` }
      : { accept: 'application/json', cookie: `theme=dark; zz_console=${value}; zz-stack-tab=work`, referer: 'http://127.0.0.1:3100/initiatives' };
    const res = await fetch(`${base}/api/console/${scoped(path)}`, { headers, signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    return [res.status, text ? JSON.parse(text) : null];
  }
  const all = (base: string, value: string, paths: string[], from: 'server' | 'browser' = 'server') => Promise.all(paths.map((p) => read(base, value, p, from)));

  it.each(['empty', 'error', 'extreme', 'partial'])('%s: answers that state on every route to both people, and leaves the process-wide mode as it was', async (state) => {
    const base = await start();
    for (const person of ['superadmin', 'member']) {
      const paths = routesOf(person);
      const normal = await all(base, person, paths);
      const asked = await all(base, `${person}+${state}`, paths);
      expect(await all(base, `${person}+${state}`, paths, 'browser'), `${state}, ${person}: the browser's read`).toEqual(asked);
      // Nothing about the process moved: a value with no state still reads the normal world.
      expect(await (await fetch(`${base}/api/console/__mode`)).json()).toEqual({ mode: 'normal' });
      expect(await all(base, person, paths), `${state}, ${person}: the normal state after it`).toEqual(normal);
      // And what it answered is what the process answers once that state is its mode.
      await fetch(`${base}/api/console/__mode?set=${state}`);
      const whole = await all(base, person, paths);
      await fetch(`${base}/api/console/__mode?set=normal`);
      for (const [i, path] of paths.entries()) expect(asked[i], `${state}, ${person}: GET ${path}`).toEqual(whole[i]);
      // And it is a state a page would see: somewhere its answer is not the normal one.
      expect(asked.some((a, i) => JSON.stringify(a) !== JSON.stringify(normal[i])), `${state}, ${person}`).toBe(true);
    }
  }, 60_000);

  it('answers the console server\'s own read in the state its cookie names', async () => {
    const base = await start();
    process.env.ZZ_GATEWAY = base;
    delete process.env.ZZ_DEV_PAT;
    jar.value = 'member+empty';
    expect(await gatewayGet<InitiativeList>('/initiatives')).toMatchObject({ rows: [], total: 0 });
    expect(await gatewayGet<{ role: string }>('/me')).toMatchObject({ role: 'member' });
    jar.value = 'member';
    expect((await gatewayGet<InitiativeList>('/initiatives')).rows.length).toBeGreaterThan(0);
  });

  it('slow: holds every page read past every read bound and answers who is asking at once, for that session alone', async () => {
    const base = await start();
    for (const person of ['superadmin', 'member']) {
      const at = Date.now();
      expect((await read(base, `${person}+slow`, 'me'))[0]).toBe(200);
      expect(Date.now() - at, person).toBeLessThan(1_000);
      const quickly = await fetch(`${base}/api/console/home`, { headers: { cookie: `zz_console=${person}+slow` }, signal: AbortSignal.timeout(1_000) })
        .then(() => 'answered', (e: Error) => e.name);
      expect(quickly, person).toBe('TimeoutError');
      // The same person in the normal state is not held.
      expect((await fetch(`${base}/api/console/home`, { headers: { cookie: `zz_console=${person}` }, signal: AbortSignal.timeout(1_000) })).status).toBe(200);
    }
  }, 20_000);

  it('partial: one part of every answer that has parts is unavailable, the rest answered, and Status\'s needs partial', async () => {
    const base = await start();
    type Counted = { ok: number; failed: number };
    const parts = (v: unknown, n: Counted = { ok: 0, failed: 0 }): Counted => {
      if (Array.isArray(v)) v.forEach((x) => parts(x, n));
      else if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if (o.state === 'ok' && 'data' in o && Object.keys(o).length === 2) n.ok++;
        if (o.state === 'unavailable' && o.reason === 'query_failed') n.failed++;
        Object.values(o).forEach((x) => parts(x, n));
      }
      return n;
    };
    let withParts = 0;
    for (const person of ['superadmin', 'member']) {
      for (const path of routesOf(person)) {
        const [, normal] = await read(base, person, path);
        const [code, got] = await read(base, `${person}+partial`, path);
        expect(code, `${person}: GET ${path}`).toBe(200);
        const before = parts(normal);
        if (!before.ok) { expect(got, `${person}: GET ${path} has no part, and is answered as it is`).toEqual(normal); continue; }
        withParts++;
        // One failed and the others still answered; a part nested inside the one that failed goes with it.
        const after = parts(got);
        expect(after.failed, `${person}: GET ${path}`).toBe(1);
        expect(after.ok, `${person}: GET ${path}`).toBeLessThan(before.ok);
        if (before.ok > 1) expect(after.ok, `${person}: GET ${path}`).toBeGreaterThan(0);
      }
      const status = (await read(base, `${person}+partial`, 'platform/status'))[1] as PlatformStatus;
      expect(status.needs, person).toMatchObject({ state: 'partial', total: null, headline: expect.stringMatching(/; some checks unavailable$/) });
      expect(status.needs.unavailableKinds, person).toHaveLength(1);
      expect(status.needs.rows.some((r) => status.needs.unavailableKinds.includes(r.kind)), person).toBe(false);
    }
    expect(withParts).toBeGreaterThan(10);
  }, 30_000);

  it('refuses a state it does not draw with a 400 naming it, before anything is answered', async () => {
    const base = await start();
    for (const path of ['me', 'home', 'platform/status']) {
      const [code, body] = await read(base, 'member+sideways', path);
      expect(code, path).toBe(400);
      expect((body as { error: string }).error, path).toMatch(/"sideways".*normal, empty, error, slow, extreme, partial/);
    }
  });

  it('extreme: hands the request\'s query to the state, so a second page of ten holds other rows than the first', async () => {
    // Every list a page reads at ten, the fixture holding fewer than a busy platform: a later page is grown too.
    const base = await start();
    const LISTS = [['initiatives', 'rows', 'slug'], ['teams', 'teams', 'slug'], ['people', 'people', 'email'], ['knowledge', 'rows', 'key'], ['activity', 'rows', 'id'], ['runs', 'recent', 'id']] as const;
    for (const [path, key, name] of LISTS) {
      const page = async (offset: number) => {
        const got = (await read(base, 'superadmin+extreme', `${path}?limit=10&offset=${offset}`))[1] as Record<string, unknown>;
        const rows = (key === 'recent' ? (got.recent as { data: { rows: unknown[] } }).data.rows : got[key]) as Record<string, string>[];
        return rows.map((r) => r[name]);
      };
      const [first, second, far] = [await page(0), await page(10), await page(200)];
      expect([first.length, second.length, far.length], path).toEqual([10, 10, 10]);
      for (const row of second) expect(first, path).not.toContain(row);
      expect(await page(10), `${path}: the same page twice`).toEqual(second);
    }
  });

  it('stands a number in for every unread figure of one session value while a check asks, and for nobody else', async () => {
    // What scripts/states-check.ts reads a page twice by: a zero drawn where the answer sent null turns into this number.
    const base = await start();
    const figure = async (value: string) => ((await read(base, value, 'platform/usage'))[1] as Usage).tiles;
    const hook = (value: string, on: number) => fetch(`${base}/api/console/__nulls?session=${encodeURIComponent(value)}&on=${on}`);
    expect((await hook('member+empty', 1)).status).toBe(200);
    expect(await figure('member+empty')).toMatchObject({ state: 'ok', data: { calls: { last: { figure: { value: NULL_STANDIN, why: 'no_data' }, numerator: NULL_STANDIN } } } });
    // Another session value, the same person in the normal world among them, reads the nulls as they are.
    expect(await figure('superadmin+empty')).toMatchObject({ state: 'ok', data: { calls: { last: { figure: { value: null } } } } });
    expect((await read(base, 'member', 'platform/usage'))[1]).toEqual((await read(base, 'member+normal', 'platform/usage'))[1]);
    await hook('member+empty', 0);
    expect(await figure('member+empty')).toMatchObject({ state: 'ok', data: { calls: { last: { figure: { value: null } } } } });
    // Only a session value that names a state can be asked for, so no suite reading the process-wide mode is moved.
    expect((await hook('member', 1)).status).toBe(400);
  });

  it('empty: draws every detail route as the record there with nothing in it', async () => {
    const base = await start();
    const get = async <T,>(path: string) => (await read(base, 'superadmin+empty', path))[1] as T;
    expect(await get<InitiativeDetail>('initiatives/atlas/2026-09-28-search-relevance')).toMatchObject({ slug: '2026-09-28-search-relevance', documents: [], steps: [] });
    expect(await get<DocumentDetail>('document/atlas/2026-09-28-search-relevance/spec.md')).toMatchObject({ path: 'spec.md', body: null, versions: [], sources: [] });
    expect(await get<KnowledgeBody>(NODE)).toMatchObject({ body: '', related: [], evidence: null });
    expect(await get<TeamDetail>('teams/atlas')).toMatchObject({ members: [], calls: [] });
    // A release and a report are what a fresh deployment holds none of: their routes answer as for an id nobody holds.
    for (const path of ['platform/releases/0.97.0', 'platform/bugs/0b3f2a6e-8c41-4d2a-9f10-2e6c4b7a1d01']) expect(await read(base, 'superadmin+empty', path), path).toEqual([404, null]);
    expect(await get<Releases>('platform/releases')).toMatchObject({ rows: { state: 'ok', data: { rows: [], total: 0 } }, tiles: { releases: 0, latest: null } });
    expect(await get<PluginEval>('plugins/sdlc/eval')).toEqual({ plugin: 'sdlc', found: false });
    const usage = await get<Usage>('platform/usage');
    expect(usage.tiles.state === 'ok' && usage.tiles.data.calls.last.figure).toEqual({ value: null, why: 'no_data' });
    const record = await get<RecordRead>('record');
    // Nothing written is an estimate of nothing; a null estimate is a store that could not be read.
    expect(record.lead.estimate).toMatchObject({ words: 0, hours: 0, coverage: { documents: 0 } });
    expect(record.record.state === 'ok' && record.record.data.rows).toEqual([]);
  });
});

/**
 * A busy platform above every ceiling (Task I-127, AC-2.7): `extreme` answers past each ceiling the spec and the gateway
 * set, in the gateway's shapes, a list paged by the request's offset so a second page holds other rows. A list the gateway
 * cuts to a count of its own (five newest, five most rewritten, ten tools, five needs) is answered full, with more beyond.
 */
describe('a busy platform is above every ceiling', () => {
  let base = '';
  let stop = () => {};
  beforeAll(async () => { const gateway = await startFakeGateway(); base = gateway.base; stop = () => gateway.proc.kill(); });
  afterAll(() => stop());
  const busy = async <T,>(path: string, person = 'superadmin'): Promise<T> => {
    const res = await fetch(`${base}/api/console/${path}${path.includes('?') ? '&' : '?'}scope=platform`, { headers: { cookie: `zz_console=${person}+extreme` } });
    expect(res.status, `${person}: GET ${path}`).toBe(200);
    return await res.json() as T;
  };
  const DAY = 86_400_000;
  /** A series' grain, by its first whole period's length. */
  const grainOf = (windows: Window[]) => {
    const days = (Date.parse(windows[1].to) - Date.parse(windows[1].from)) / DAY;
    return days <= 7 ? 'week' : days <= 31 ? 'month' : 'quarter';
  };
  const spanYears = (windows: Window[]) => (Date.parse(windows.at(-1)!.to) - Date.parse(windows[0].from)) / (365 * DAY);

  it('Audit: the latest 500 events, as its ceiling says, ten a page to the last', async () => {
    const page = (offset: number) => busy<Audit>(`platform/audit?filter=all&limit=10&offset=${offset}`);
    const [first, second, last, past] = [await page(0), await page(10), await page(490), await page(500)];
    expect([first.total, first.ceiling, first.rows.length, last.rows.length, past.rows.length]).toEqual([500, 500, 10, 10, 0]);
    for (const r of second.rows) expect(first.rows.map((x) => x.id)).not.toContain(r.id);
  });

  it('Record: months past 26 weeks, quarters past three years, days across years, and the most rewritten at its five', async () => {
    const year = await busy<RecordRead>('record?period=year');
    const all = await busy<RecordRead>('record?period=all&limit=10&offset=10');
    // This year so far is a period of weeks until it passes 26 of them, and of months after (work-record.ts, as the
    // gateway's grainFor): the grain follows today's date, which a fixed 'month' read as red from January to July.
    const weeksIn = (Date.parse(year.meta.period.to) - Date.parse(year.meta.period.from)) / (7 * 24 * 3_600_000);
    expect(grainOf(year.cumulative.map((p) => p.window))).toBe(weeksIn <= 26 ? 'week' : 'month');
    const windows = all.cumulative.map((p) => p.window);
    expect(grainOf(windows)).toBe('quarter');
    expect(spanYears(windows)).toBeGreaterThan(3);
    // Every series of the period is cut at the one grain, so the page's one cursor reads each at the same period.
    const work = all.work.state === 'ok' ? all.work.data : null;
    const docs = all.documents.state === 'ok' ? all.documents.data : null;
    const know = all.knowledge.state === 'ok' ? all.knowledge.data : null;
    for (const series of [work!.closuresInAll, work!.closuresByWeek, work!.medianHoursByWeek, docs!.wordsByWeek, know!.adoptedInAll, know!.searchesWithResults]) {
      expect(series.map((p) => p.window.from)).toEqual(windows.map((w) => w.from));
    }
    const days = all.agents.state === 'ok' ? all.agents.data.days : [];
    expect(new Set(days.map((d) => d.day.slice(0, 4))).size).toBeGreaterThan(1);
    expect(docs!.mostRewritten).toHaveLength(5);
    expect(docs!.versions.value).toBeGreaterThan(5);
    const rec = all.record.state === 'ok' ? all.record.data : null;
    expect(rec!.total).toBeGreaterThan(10);
    expect(rec!.rows).toHaveLength(10);
  });

  it('Initiatives: the closures regrouped by month once the record is past 26 weeks', async () => {
    const list = await busy<InitiativeList>('initiatives');
    const windows = list.closures.state === 'ok' ? list.closures.data.map((c) => c.window) : [];
    expect(grainOf(windows)).toBe('month');
    expect(windows.length).toBeGreaterThan(6);
  });

  it('Usage: every called tool up to ten in the normal state, as the gateway answers it', () => {
    const normal = usage(true);
    const tools = normal.tools.state === 'ok' ? normal.tools.data : null;
    const most = normal.mostUsed.state === 'ok' ? normal.mostUsed.data : null;
    expect(tools!.rows).toHaveLength(Math.min(10, tools!.total));
    expect(tools!.total).toBe(most!.total);
    expect(tools!.rows.map((r) => r.tool)).toEqual(most!.rows.filter((r) => r.tool !== 'Unregistered tools').map((r) => r.tool));
  });

  it('Usage: the tools past ten, and the fourth part Other for every team past the three with the most calls', async () => {
    const u = await busy<Usage>('platform/usage');
    const tools = u.tools.state === 'ok' ? u.tools.data : null;
    const most = u.mostUsed.state === 'ok' ? u.mostUsed.data : null;
    expect([tools!.rows.length, most!.rows.length]).toEqual([10, 10]);
    expect(Math.min(tools!.total, most!.total)).toBeGreaterThan(10);
    const weeks = u.callsByWeek.state === 'ok' ? u.callsByWeek.data.weeks : [];
    const teamsBusy = await busy<Teams>('teams');
    expect(teamsBusy.total).toBeGreaterThanOrEqual(5);
    for (const w of weeks.filter((x) => x.calls.value)) {
      expect(w.parts!.map((p) => p.label).at(-1)).toBe('Other');
      expect(w.parts).toHaveLength(4);
      expect(w.parts!.reduce((n, p) => n + p.calls, 0)).toBe(w.calls.value);
    }
  });

  it('Approvals waiting, Releases, Bugs and Evaluation past ten, each second page other rows', async () => {
    const waiting = async (offset: number) => (await busy<Approvals>(`approvals?tab=waiting&limit=10&offset=${offset}`)).waiting;
    const rel = async (offset: number) => (await busy<Releases>(`platform/releases?limit=10&offset=${offset}`)).rows;
    const bug = async (offset: number) => (await busy<Bugs>(`platform/bugs?limit=10&offset=${offset}`)).queue;
    for (const [what, page, key] of [['approvals', waiting, 'contentRevision'], ['releases', rel, 'version'], ['bugs', bug, 'id']] as const) {
      const [a, b] = [await page(0), await page(10)] as { state: string; data: { rows: Record<string, string>[]; total: number } }[];
      expect(a.data.total, what).toBeGreaterThan(10);
      expect([a.data.rows.length, b.data.rows.length], what).toEqual([10, 10]);
      for (const r of b.data.rows) expect(a.data.rows.map((x) => x[key]), what).not.toContain(r[key]);
    }
    const e = await busy<Evaluation>('platform/evaluation');
    for (const part of [e.plugins, e.history]) expect(part.state === 'ok' && part.data.length).toBeGreaterThan(10);
    expect(e.waiting.state === 'ok' && e.waiting.data.total).toBeGreaterThan(10);
    expect(e.tiles.waiting).toBe(e.waiting.state === 'ok' ? e.waiting.data.total : null);
  });

  it('Knowledge: the newest at its five, the most asked at ten, and the shelves and the catalog past ten', async () => {
    const k = await busy<KnowledgeSummary>('knowledge/summary');
    expect(k.newest.state === 'ok' && k.newest.data).toHaveLength(5);
    expect(k.tiles.standing.value).toBeGreaterThan(5);
    const health = await busy<KnowledgeHealth>('platform/knowledge');
    expect(health.shelves.state === 'ok' && health.shelves.data.rows.length).toBeGreaterThan(10);
    const questions = health.questions?.state === 'ok' ? health.questions.data : null;
    expect([questions!.rows.length, questions!.total > 10]).toEqual([10, true]);
    expect((await busy<{ plugins: unknown[] }>('plugins')).plugins.length).toBeGreaterThan(10);
  });

  it('Status: more than five needs, a drift need among them, and more than five instances of one kind', async () => {
    for (const person of ['superadmin', 'member']) {
      const { needs } = await busy<PlatformStatus>('platform/status', person);
      expect(needs.rows, person).toHaveLength(5);
      expect(needs.total, person).toBeGreaterThan(5);
      // Every instance is in a row or counted in the overflow by its kind, so the two add up to the total.
      const overflow = Object.values(needs.overflowByKind).reduce((n, c) => n + (c ?? 0), 0);
      expect(needs.rows.reduce((n, r) => n + r.instanceCount, 0) + overflow, person).toBe(needs.total);
      expect(needs.rows.some((r) => r.kind === 'drift') || (needs.overflowByKind.drift ?? 0) > 0, person).toBe(true);
      const approvals = needs.rows.filter((r) => r.kind === 'approvals').reduce((n, r) => n + r.instanceCount, 0) + (needs.overflowByKind.approvals ?? 0);
      expect(approvals, person).toBeGreaterThan(5);
    }
    // The member reads every team's approvals as one row, which counts them.
    const member = (await busy<PlatformStatus>('platform/status', 'member')).needs;
    expect(member.rows.find((r) => r.kind === 'approvals')!.instanceCount).toBeGreaterThan(5);
    expect(member.rows.some((r) => r.kind === 'drift')).toBe(true);
  });

  it('Home: runs in more than four initiatives, open work past five, and one document waiting', async () => {
    for (const person of ['superadmin', 'member']) {
      const h = await busy<Home>('home', person);
      const runs = h.runs.state === 'ok' ? h.runs.data : null;
      expect(runs!.active, person).toHaveLength(4);
      expect(runs!.more, person).toBeGreaterThan(0);
      expect(runs!.active.reduce((n, g) => n + g.runs.length, 0), person).toBeGreaterThan(4);
      const open = h.openWork.state === 'ok' ? h.openWork.data : null;
      expect(open!.rows.length + (open!.quiet ? 1 : 0), person).toBe(5);
      expect(open!.total, person).toBeGreaterThan(5);
      expect(h.waiting.state === 'ok' && h.waiting.data, person).toMatchObject({ count: 1, one: { path: expect.any(String) } });
    }
  });
});
