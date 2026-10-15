// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActivityLog, ActivitySummary, KnowledgeList, KnowledgeSummary, Runs } from '../src/lib/destination-shapes.ts';
import type { InitiativeList } from '../src/lib/work-shapes.ts';
import { ME } from '../scripts/fake-gateway/people.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { access } from '../scripts/fake-gateway/work-access.ts';
import { activityLog, activitySummary } from '../scripts/fake-gateway/work-activity.ts';
import { initiativeList } from '../scripts/fake-gateway/work-initiatives.ts';
import { knowledgeList, knowledgeSummary } from '../scripts/fake-gateway/work-knowledge.ts';
import { plugins } from '../scripts/fake-gateway/work-plugins.ts';
import { runs } from '../scripts/fake-gateway/work-runs.ts';
import config from '../scripts/verify.config.ts';

/**
 * The fixture's own modes, which are what every state the console draws is checked against.
 *
 * `pnpm verify` runs `normal` only, so a mode that throws is a mode nothing notices — and this one
 * threw out of the request handler and killed the gateway process: every page after it reported
 * "cannot reach the platform", and the shape that caused it was the only thing the report did not
 * show. A transform reads an answer by its own idea of that route's shape, so a route that grows a
 * second answer — `/initiatives?waiting=1` returns `{ waiting }`, the list returns `{ rows, total, … }`
 * — is where it will break next.
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
describe('the fixture can shape every answer its routes produce', () => {
  it('leaves an empty projection empty rather than inventing rows', () => {
    // Nothing waiting is a state the console draws ("Nothing needs a signature"); forty fabricated
    // gates would be a state it could never reach.
    expect(extreme(['initiatives'], { waiting: [] })).toEqual({ waiting: [] });
  });

  it('leaves an empty list empty rather than inventing rows it cannot shape', () => {
    // `/initiatives?team=<a team with no work>` is empty, and it is a state the console draws. A
    // mode that filled it in grew its rows from `rows[i % 0]` — `undefined` — so every fabricated
    // row carried the slug below and none of the fields an initiative has. The page's columns
    // dereference `stages`, and /teams/dune died in its error boundary on the whole page.
    const none = NONE();
    expect((extreme(['initiatives'], none) as InitiativeList)).toMatchObject({ rows: [], total: 0 });
    expect(extreme(['teams'], { teams: [] })).toEqual({ teams: [] });
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

  it('shapes a projection that has rows', () => {
    const one = { id: 'a/b/approve spec', gate: 'spec', team: 'a', slug: 'b', updated: '2026-10-05', stage: 'spec', at: 2, of: 7 };
    const got = extreme(['initiatives'], { waiting: [one] }) as { waiting: unknown[] };
    expect(got.waiting.length).toBeGreaterThan(1);
    expect(got.waiting[0]).toEqual(one);
  });

  it('shapes every answer the routes actually produce, empty lists included', () => {
    // Each route paired with the answers `read()` gives it — the property that matters: a shape a
    // route really produces must not be a shape this mode does not know. The server catches what is
    // left out, so an unrecognised answer is served as it is rather than taking the gateway down;
    // that is a backstop, not the contract.
    const answers: [string[], unknown][] = [
      [['initiatives'], { waiting: [{ id: 'x', gate: 'g', team: 'a', slug: 'b', updated: 'u', stage: 's', at: 1, of: 2 }] }],
      [['initiatives'], { waiting: [] }],
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
      [['teams'], { teams: [] }],
      [['people'], { people: [] }],
      [['platform', 'status'], PLATFORM_STATUS],
      [['unknown-head'], { anything: true }],
      [[], {}],
    ];
    for (const [seg, body] of answers) {
      expect(() => extreme(seg, body), `extreme(${JSON.stringify(seg)}) threw`).not.toThrow();
      expect(() => empty(seg, body), `empty(${JSON.stringify(seg)}) threw`).not.toThrow();
    }
  });

  it('empties the projection of what waits, as it empties the list', () => {
    // A fresh deployment has no gate waiting on anybody: the bell read the same seven it reads on a busy one.
    const one = { id: 'a/b/approve spec', gate: 'spec', team: 'a', slug: 'b', updated: '2026-10-05', stage: 'spec', at: 2, of: 7 };
    expect(empty(['initiatives'], { waiting: [one] })).toEqual({ waiting: [] });
    const list = empty(['initiatives'], LIST()) as InitiativeList;
    expect(list).toMatchObject({ rows: [], total: 0, tiles: { open: 0, waiting: 0, closed: { accepted: 0, delivered: 0, abandoned: 0 } } });
    expect(list.summary.state === 'ok' && list.summary.data.total).toBe(0);
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

  it('serves the platform\'s status as it is in both worlds', () => {
    // Neither mode knows the status read, so both leave it alone: its weeks, and the four it picks from them, stay
    // whole. A mode that emptied them would hand a page a shape the fixture is held never to have.
    expect(extreme(['platform', 'status'], PLATFORM_STATUS)).toBe(PLATFORM_STATUS);
    expect(empty(['platform', 'status'], PLATFORM_STATUS)).toBe(PLATFORM_STATUS);
  });
});

describe('a busy platform is still one team to a member', () => {
  const person = { email: 'a@example.com', name: 'A', role: 'member', status: 'active', created: '2026-10-01', activeTeam: 'atlas', teams: ['atlas (admin)'], tokens: 1, last_used: null };
  const entry = { ts: '2026-10-05T00:00:00Z', actor: 'a@example.com', team: 'beacon', kind: 'knowledge.add', node: '0001', recorded_title: 't', superseded_by: null, node_title: 't', node_status: 'adopted' };

  it('grows no team beside their own', () => {
    const one = { slug: 'atlas', name: 'Atlas Research' };
    expect(extreme(['teams'], { teams: [one] }, 'atlas')).toEqual({ teams: [one] });
    expect((extreme(['teams'], { teams: [one] }) as { teams: unknown[] }).teams.length).toBeGreaterThan(1);
  });

  it('grows people and log entries that name their team and no other', () => {
    const people = (extreme(['people'], { people: [person] }, 'atlas') as { people: { teams: string[] }[] }).people;
    expect(people.length).toBeGreaterThan(100);
    for (const p of people) for (const t of p.teams) expect(t.startsWith('atlas (')).toBe(true);
    // Held to nobody, the same rows name the platform's other teams, which is what the superadmin is shown.
    const fleet = (extreme(['people'], { people: [person] }) as { people: { teams: string[] }[] }).people;
    expect(fleet.at(-1)!.teams.length).toBeGreaterThan(1);

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
  function start(mode: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const p = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0', '--mode', mode], { stdio: ['ignore', 'pipe', 'pipe'] });
      servers.push(p);
      let out = '';
      const timer = setTimeout(() => reject(new Error(`no address printed: ${out}`)), 15_000);
      p.stdout!.on('data', (d: Buffer) => {
        out += String(d);
        const m = /listening on (\S+)/.exec(out);
        if (m) { clearTimeout(timer); resolve(m[1]); }
      });
      p.stderr!.on('data', (d: Buffer) => { out += String(d); });
      p.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
    });
  }

  /** Each person by the cookie `pnpm verify --as` sends for them; the superadmin also as the default run asks, with none. */
  const PEOPLE: [name: string, role: string, cookie: string | null][] = [
    ['no cookie', 'superadmin', null],
    ['superadmin', 'superadmin', config.personas!.superadmin.cookie.value],
    ['member', 'member', config.personas!.member.cookie.value],
  ];
  const ask = (base: string, cookie: string | null, path: string, ms = 10_000) =>
    fetch(`${base}/api/console/${path}`, { headers: cookie === null ? {} : { cookie: `zz_console=${cookie}` }, signal: AbortSignal.timeout(ms) });
  const READS = ['overview', 'initiatives', 'initiatives?waiting=1', 'knowledge', 'knowledge/summary', 'knowledge/log', 'activity',
                 'activity/summary', 'runs', 'plugins', 'skills', 'access', 'settings/me/tokens', 'settings/me/teams', 'platform/status',
                 'home', 'record', 'approvals', 'work/query?measure=closures&by=outcome'];
  /** The superadmin's alone: a member is refused them in every world. */
  const FLEET = ['teams', 'teams?scope=platform', 'teams/atlas', 'people', 'people?scope=platform'];
  const REFUSAL = { error: 'not permitted' };

  /** Every list a rail page reads, as the rows it answers; Teams and People only to the superadmin, who may read them. */
  async function lists(base: string, cookie: string | null, superadmin: boolean) {
    const get = async (path: string) => (await ask(base, cookie, path)).json() as Promise<Record<string, { team: string; teams: string[] }[]>>;
    return {
      teams: superadmin ? (await get('teams?scope=platform&limit=100')).teams : [],
      people: superadmin ? (await get('people?scope=platform&limit=100')).people : [],
      initiatives: (await get('initiatives?scope=platform&limit=100')).rows,
      byTeam: [
        ...(await get('initiatives?waiting=1&scope=platform')).waiting,
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
      else if (role === 'member') {
        expect(byTeam.length).toBeGreaterThan(20);
        for (const row of byTeam) expect(row.team, JSON.stringify(row).slice(0, 120)).toBe(me.activeTeam);
      } else {
        expect(teams.length, name).toBeGreaterThan(mode === 'extreme' ? 60 : 3);
        expect(new Set(byTeam.map((r) => r.team)).size, name).toBeGreaterThan(2);
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

  it('slow: an answer is held four seconds for both', async () => {
    const base = await start('slow');
    await Promise.all(PEOPLE.map(async ([name, role, cookie]) => {
      const quickly = await ask(base, cookie, 'me', 1000).then(() => 'answered', (e: Error) => e.name);
      expect(quickly, name).toBe('TimeoutError');
      const later = await ask(base, cookie, 'me', 8000);
      expect((await later.json() as Me).role, name).toBe(role);
    }));
  }, 20_000);
});
