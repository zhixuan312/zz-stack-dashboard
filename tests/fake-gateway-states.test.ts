// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDetail, InitiativeDetail, KnowledgeBody, PluginEval } from '../src/lib/api-shapes.ts';
import type { ActivityLog, ActivitySummary, KnowledgeList, KnowledgeSummary, Runs } from '../src/lib/destination-shapes.ts';
import type { People, TeamDetail, Teams, Usage } from '../src/lib/fleet-shapes.ts';
import type { PlatformStatus, Releases } from '../src/lib/platform-shapes.ts';
import type { Approvals, Home, InitiativeList, RecordRead } from '../src/lib/work-shapes.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { people as peopleAnswer } from '../scripts/fake-gateway/platform-people.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { teamDetail, teams } from '../scripts/fake-gateway/platform-teams.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { NULL_STANDIN } from '../scripts/fake-gateway/states-partial.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { approvals } from '../scripts/fake-gateway/work-approvals.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeList, knowledgeSummary } from '../scripts/fake-gateway/work-knowledge.ts';
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
      [['knowledge', 'log'], { entries: [] }],
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

  it('makes busy teams a page of long names under large counts, and a fresh platform none at all', () => {
    // Teams is paged and counted on the server, as Initiatives is: a page holds what it asked for, and the tiles and
    // the total are every team's, never the page's.
    const list = TEAMS();
    const busy = extreme(['teams'], list) as Teams;
    expect(busy.teams).toHaveLength(list.teams.length);
    expect(busy.total).toBeGreaterThan(100);
    expect(busy.tiles.teams).toBe(busy.total);
    for (const [i, row] of busy.teams.entries()) {
      expect(Object.keys(row).sort(), `a row lost a field: ${JSON.stringify(row)}`).toEqual(Object.keys(list.teams[i]).sort());
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
    expect(fresh.tiles.refused.owners).toEqual({ guardrail: 0, ours: 0, theirs: 0, other: 0 });
    expect(fresh.tiles.mostRefused).toBeNull();
    expect(empty(['runs'], RUNS())).toMatchObject({ since: null, tiles: { largest: null, outputPerRun: { value: null } } });
    expect(empty(['knowledge', 'summary'], LEARNED())).toMatchObject({ questions: { state: 'ok', data: { rows: [], total: 0 } } });
  });

  it('serves the platform\'s status whole to a busy platform, and as a fresh deployment answers it to an empty one', () => {
    expect(extreme(['platform', 'status'], PLATFORM_STATUS)).toBe(PLATFORM_STATUS);
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

  it('is a page of long names under large counts on a busy platform, never more rows than the page asked for', () => {
    const list = PEOPLE_LIST();
    const got = extreme(['people'], list) as People;
    expect(got.people).toHaveLength(list.people.length);
    expect(got.total).toBeGreaterThan(100);
    expect(got.tiles.people).toBe(got.total);
    for (const [i, row] of got.people.entries()) {
      expect(Object.keys(row).sort(), `a row lost a field: ${JSON.stringify(row)}`).toEqual(Object.keys(list.people[i]).sort());
      expect(row.name.length).toBeGreaterThan(60);
      expect(row.teams.length).toBeGreaterThan(1);
    }
  });
});

describe('a busy platform is still one team to a member', () => {
  const entry = { ts: '2026-10-05T00:00:00Z', actor: 'a@example.com', team: 'beacon', kind: 'knowledge.add', node: '0001', recorded_title: 't', superseded_by: null, node_title: 't', node_status: 'adopted' };

  it('grows no team beside their own', () => {
    // The gateway refuses a member Teams, so this answer is never theirs; held to a team, it is left as it is.
    expect(extreme(['teams'], TEAMS(), 'atlas')).toEqual(TEAMS());
  });

  it('grows no person, and log entries that name their team and no other', () => {
    // The gateway refuses a member People, so this answer is never theirs; held to a team, it is left as it is.
    expect(extreme(['people'], PEOPLE_LIST(), 'atlas')).toEqual(PEOPLE_LIST());

    const log = (extreme(['knowledge', 'log'], { entries: [entry] }, 'beacon') as { entries: { team: string }[] }).entries;
    expect(log.length).toBeGreaterThan(100);
    for (const e of log) expect(e.team).toBe('beacon');
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
    // The status is one public answer in every world, but for what needs attention, which a member reads in their projection.
    const status = await Promise.all(PEOPLE.map(async ([, , cookie]) => ({ ...(await (await ask(base, cookie, 'platform/status')).json()), needs: null })));
    expect(status[1]).toEqual(status[0]);
    expect(status[2]).toEqual(status[0]);
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

  it('slow: a page read is held four seconds for both, and who is asking is answered at once', async () => {
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

  it('slow: holds every page read four seconds and answers who is asking at once, for that session alone', async () => {
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

  it('extreme: hands the request\'s query to the state, so a second page holds other names than the first', async () => {
    const base = await start();
    const page = async (offset: number) => ((await read(base, 'superadmin+extreme', `initiatives?limit=2&offset=${offset}`))[1] as InitiativeList).rows.map((r) => r.slug);
    const [first, second] = [await page(0), await page(2)];
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    for (const slug of second) expect(first).not.toContain(slug);
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
