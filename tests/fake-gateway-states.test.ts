// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import config from '../scripts/verify.config.ts';

/**
 * The fixture's own modes, which are what every state the console draws is checked against.
 *
 * `pnpm verify` runs `normal` only, so a mode that throws is a mode nothing notices — and this one
 * threw out of the request handler and killed the gateway process: every page after it reported
 * "cannot reach the platform", and the shape that caused it was the only thing the report did not
 * show. A transform reads an answer by its own idea of that route's shape, so a route that grows a
 * second answer — `/initiatives?waiting=1` returns `{ waiting }`, the list returns `{ initiatives }`
 * — is where it will break next.
 */
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
    expect(extreme(['initiatives'], { initiatives: [] })).toEqual({ initiatives: [] });
    expect(extreme(['teams'], { teams: [] })).toEqual({ teams: [] });
    expect(extreme(['knowledge'], { nodes: [] })).toEqual({ nodes: [] });
  });

  it('every row it adds keeps the shape of the row it was grown from', () => {
    const one = { slug: 'a', stages: [{ name: 'spec', state: 'done' }], gates: [], team: 'atlas', closed: false };
    const got = extreme(['initiatives'], { initiatives: [one] }) as { initiatives: Record<string, unknown>[] };
    expect(got.initiatives.length).toBeGreaterThan(1);
    for (const row of got.initiatives) {
      expect(Array.isArray(row.stages), `a row lost its stages: ${JSON.stringify(row)}`).toBe(true);
      expect(row.team).toBe('atlas');
    }
  });

  it('shapes a projection that has rows', () => {
    const one = { id: 'a/b/approve spec', gate: 'spec', team: 'a', slug: 'b', updated: '2026-10-05', stage: 'spec', at: 2, of: 7 };
    const got = extreme(['initiatives'], { waiting: [one] }) as { waiting: unknown[] };
    expect(got.waiting.length).toBeGreaterThan(1);
    expect(got.waiting[0]).toEqual(one);
  });

  it('shapes the list it has always shaped', () => {
    const one = { team: 'a', slug: 'b', flow: null, documents: 1, approvals: 0, updated: '2026-10-05',
                  stakeholder: null, at: 1, of: 7, stage: 'open', steps: [], gates: [], accepted: false,
                  complete: false, closed: false, outcome: null };
    const got = extreme(['initiatives'], { initiatives: [one] }) as { initiatives: unknown[] };
    expect(got.initiatives.length).toBeGreaterThan(1);
  });

  it('shapes every answer the routes actually produce, empty lists included', () => {
    // Each route paired with the answers `read()` gives it — the property that matters: a shape a
    // route really produces must not be a shape this mode does not know. The server catches what is
    // left out, so an unrecognised answer is served as it is rather than taking the gateway down;
    // that is a backstop, not the contract.
    const answers: [string[], unknown][] = [
      [['initiatives'], { waiting: [{ id: 'x', gate: 'g', team: 'a', slug: 'b', updated: 'u', stage: 's', at: 1, of: 2 }] }],
      [['initiatives'], { waiting: [] }],
      [['initiatives'], { initiatives: [] }],
      [['knowledge'], { nodes: [] }],
      [['knowledge', 'log'], { entries: [] }],
      [['teams'], { teams: [] }],
      [['people'], { people: [] }],
      [['runs'], { totals: { runs: 1, calls: 1, refusals: 0, mb: null } }],
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
    expect(empty(['initiatives'], { initiatives: [{ slug: 'b' }] })).toEqual({ initiatives: [] });
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
  const READS = ['overview', 'teams', 'initiatives', 'initiatives?waiting=1', 'knowledge', 'knowledge/log', 'people', 'activity', 'runs',
                 'plugins', 'skills', 'settings/me/tokens', 'settings/me/teams', 'platform/status'];

  /** Every list a rail page reads, as the rows it answers. */
  async function lists(base: string, cookie: string | null) {
    const get = async (path: string) => (await ask(base, cookie, path)).json() as Promise<Record<string, { team: string; teams: string[] }[]>>;
    return {
      teams: (await get('teams?scope=platform')).teams,
      people: (await get('people?scope=platform')).people,
      byTeam: [
        ...(await get('initiatives?scope=platform')).initiatives, ...(await get('initiatives?waiting=1&scope=platform')).waiting,
        ...(await get('knowledge?scope=platform')).nodes, ...(await get('knowledge/log?scope=platform')).entries,
        ...(await get('activity?scope=platform')).events,
      ],
    };
  }

  it.each(['normal', 'empty', 'extreme'])('%s: every read answers, and the member is held to their own team', async (mode) => {
    const base = await start(mode);
    for (const [name, role, cookie] of PEOPLE) {
      const me = await (await ask(base, cookie, 'me')).json() as Me;
      expect(me.role, name).toBe(role);
      for (const path of READS) expect((await ask(base, cookie, path)).status, `${mode}, ${name}: GET ${path}`).toBe(200);

      const { teams, people, byTeam } = await lists(base, cookie);
      if (mode === 'empty') expect([teams, people, byTeam], name).toEqual([[], [], []]);
      else if (role === 'member') {
        expect(teams, name).toHaveLength(1);
        expect(byTeam.length).toBeGreaterThan(20);
        for (const row of byTeam) expect(row.team, JSON.stringify(row).slice(0, 120)).toBe(me.activeTeam);
        expect(people.length).toBeGreaterThan(1);
        for (const p of people) for (const t of p.teams) expect(t.startsWith(`${me.activeTeam} (`), t).toBe(true);
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
