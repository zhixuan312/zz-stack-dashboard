// @vitest-environment node
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NO_SESSION } from '../scripts/fake-gateway/people.ts';
import { PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import config from '../scripts/verify.config.ts';

/**
 * The fixture as two people, which is how `pnpm verify --as` uses it.
 *
 * Who is asking is the `zz_console` cookie's value: no cookie is the superadmin, because the default `pnpm verify`
 * signs nobody in and must keep reading what it read before there was a second person; the member's value is one
 * person in one team; any other value is a browser with no session. The cookies are taken from the personas
 * `scripts/verify.config.ts` declares, since those are what a browser suite is signed in with, so a persona whose
 * cookie the fixture does not read fails here rather than in a browser.
 *
 * What a member may be answered is written out below and never read from the fixture's own tables: their team is
 * found from `/me`, and every other team's slug and name from what the superadmin is answered.
 */
type Json = Record<string, unknown>;
type Team = { slug: string; name: string };
type Me = { email: string; role: string; superadmin: boolean; teams: { slug: string; role: string }[]; activeTeam: string | null };

const personas = config.personas!;
const SUPERADMIN = personas.superadmin.cookie.value;
const MEMBER = personas.member.cookie.value;

let server: ChildProcess;
let base = '';

beforeAll(async () => {
  base = await new Promise<string>((resolve, reject) => {
    server = spawn('node', ['scripts/fake-gateway/server.ts', '--port', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => reject(new Error(`no address printed: ${out}`)), 15_000);
    server.stdout!.on('data', (d: Buffer) => {
      out += String(d);
      const m = /listening on (\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    server.stderr!.on('data', (d: Buffer) => { out += String(d); });
    server.on('close', (code) => { clearTimeout(timer); reject(new Error(`the fixture exited ${code}: ${out}`)); });
  });
});
afterAll(() => { server?.kill(); });

/** One request as the person a cookie value names; `null` sends no cookie at all. */
const ask = (who: string | null, path: string, init: RequestInit = {}) => fetch(`${base}/api/console/${path}`, {
  ...init, headers: { ...(init.headers as Record<string, string>), ...(who === null ? {} : { cookie: `zz_console=${who}` }) },
});
const read = async <T = Json>(who: string | null, path: string) => {
  const res = await ask(who, path);
  expect(res.status, `${who ?? 'no cookie'} GET ${path}`).toBe(200);
  return res.json() as Promise<T>;
};
const post = (who: string | null, path: string, body: unknown) => ask(who, path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

/** The member's one team, and every other team's slug and name, as whole words. */
async function teams(): Promise<{ own: string; others: Team[]; named: RegExp }> {
  const own = (await read<Me>(MEMBER, 'me')).activeTeam!;
  const all = (await read<{ teams: Team[] }>(SUPERADMIN, 'teams?scope=platform')).teams;
  const others = all.filter((t) => t.slug !== own);
  const words = others.flatMap((t) => [t.slug, t.name]).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { own, others, named: new RegExp(`\\b(${words.join('|')})\\b`, 'i') };
}

/** Every read a member's pages make, found by following the member's own answers. */
async function memberReads(): Promise<string[]> {
  const own = (await read<Me>(MEMBER, 'me')).activeTeam!;
  const paths = [
    'me', 'overview', 'overview?period=7d', 'teams', `teams/${own}`, 'initiatives', 'initiatives?waiting=1', `initiatives?team=${own}`,
    'knowledge', 'knowledge/log', 'people', 'activity', 'activity?failed=1', 'runs', 'plugins', 'plugins/sdlc/eval',
    'plugins/sdlc/skills/sdlc-spec', 'skills', 'skills/sdlc-spec', 'search?q=recency', 'search?q=review%20rounds&limit=50',
    'settings/me/tokens', 'settings/me/client-setup', 'settings/me/teams', `settings/team/members?team=${own}`, 'platform/status',
  ];
  const { initiatives } = await read<{ initiatives: { team: string; slug: string }[] }>(MEMBER, 'initiatives');
  for (const i of initiatives) {
    paths.push(`initiatives/${i.team}/${i.slug}`);
    const detail = await read<{ documents: { path: string }[] }>(MEMBER, `initiatives/${i.team}/${i.slug}`);
    for (const d of detail.documents) paths.push(`document/${i.team}/${i.slug}/${d.path}`, `document/${i.team}/${i.slug}/${d.path}?revision=1`);
  }
  const { nodes } = await read<{ nodes: { team: string; path: string }[] }>(MEMBER, 'knowledge');
  for (const n of nodes) paths.push(`knowledge/${n.team}/${n.path}`);
  return paths.flatMap((p) => [p, `${p}${p.includes('?') ? '&' : '?'}scope=platform`]);
}

describe('who the fake gateway answers as', () => {
  it('is the superadmin with no cookie, and with the superadmin\'s', async () => {
    const bare = await read<Me>(null, 'me');
    expect(bare).toMatchObject({ role: 'superadmin', superadmin: true });
    expect(bare.teams.length).toBeGreaterThan(1);
    expect(await read<Me>(SUPERADMIN, 'me')).toEqual(bare);
    // A cookie that is not the session's says nothing about who is asking.
    const res = await fetch(`${base}/api/console/me`, { headers: { cookie: 'theme=dark; other=1' } });
    expect(await res.json()).toEqual(bare);
  });

  it('is a member of one team, and its admin, with the member\'s', async () => {
    const me = await read<Me & { mayRead: boolean }>(MEMBER, 'me');
    expect(me).toMatchObject({ role: 'member', superadmin: false, mayRead: true });
    expect(me.teams).toHaveLength(1);
    expect(me.teams[0]).toEqual({ slug: me.activeTeam, role: 'admin' });
    expect(me.email).not.toBe((await read<Me>(null, 'me')).email);
  });

  it('is nobody with any other value, on every route', async () => {
    for (const who of [NO_SESSION, 'someone-else', 'Superadmin', '']) {
      for (const path of ['me', 'teams', 'initiatives?scope=platform', 'platform/status', 'settings/me/tokens', 'no-such-route']) {
        expect((await ask(who, path)).status, `"${who}" GET ${path}`).toBe(401);
      }
      expect((await post(who, 'page-view', { feature: 'home' })).status, `"${who}" POST page-view`).toBe(401);
      expect((await ask(who, 'live?collections=teams')).status, `"${who}" GET live`).toBe(401);
    }
  });

  it('answers a plugin\'s evaluation to the superadmin and its owning team alone, one refusal for everything else', async () => {
    expect((await ask(MEMBER, 'plugins/sdlc/eval')).status).toBe(200);
    expect((await ask(MEMBER, 'plugins/no-such-plugin/eval')).status).toBe(403);
    expect(await read<{ found: boolean }>(null, 'plugins/no-such-plugin/eval')).toMatchObject({ found: false });
  });

  it('answers the superadmin with no cookie exactly what it answers their cookie', async () => {
    // The default `pnpm verify` sends no cookie, so this is what keeps its pages reading what they read.
    for (const path of ['teams', 'teams?scope=platform', 'initiatives?scope=platform', 'knowledge', 'people?scope=platform',
                        'activity?scope=platform', 'settings/me/teams', 'settings/platform/people', 'teams/beacon']) {
      expect(await read(null, path), path).toEqual(await read(SUPERADMIN, path));
    }
    expect((await read<{ teams: Team[] }>(null, 'teams')).teams.length).toBeGreaterThan(1);
    expect((await read<{ people: unknown[] }>(null, 'people?scope=platform')).people.length).toBeGreaterThan(
      (await read<{ people: unknown[] }>(MEMBER, 'people?scope=platform')).people.length);
  });
});

describe('what a member is answered', () => {
  it('lists their own team\'s records only, whether or not they ask for the platform', async () => {
    const { own } = await teams();
    for (const scope of ['', '?scope=platform']) {
      expect((await read<{ teams: Team[] }>(MEMBER, `teams${scope}`)).teams.map((t) => t.slug)).toEqual([own]);
      const rows = [
        ...(await read<{ initiatives: { team: string }[] }>(MEMBER, `initiatives${scope}`)).initiatives,
        ...(await read<{ waiting: { team: string }[] }>(MEMBER, `initiatives${scope ? `${scope}&` : '?'}waiting=1`)).waiting,
        ...(await read<{ nodes: { team: string }[] }>(MEMBER, `knowledge${scope}`)).nodes,
        ...(await read<{ entries: { team: string }[] }>(MEMBER, `knowledge/log${scope}`)).entries,
        ...(await read<{ events: { team: string }[] }>(MEMBER, `activity${scope}`)).events,
      ];
      expect(rows.length).toBeGreaterThan(20);
      for (const row of rows) expect(row.team, JSON.stringify(row).slice(0, 120)).toBe(own);

      const { people } = await read<{ people: { email: string; activeTeam: string | null; teams: string[] }[] }>(MEMBER, `people${scope}`);
      expect(people.length).toBeGreaterThan(1);
      for (const p of people) {
        expect(p.teams.length, p.email).toBeGreaterThan(0);
        for (const t of p.teams) expect(t.startsWith(`${own} (`), `${p.email}: ${t}`).toBe(true);
        expect([own, null], p.email).toContain(p.activeTeam);
      }
    }
    // The census is the team's: one team, and no more people than are in it.
    const overview = await read<{ counts: { teams: number; activeTeams: number; people: number; unattributedEvents: number } }>(MEMBER, 'overview');
    const roster = (await read<{ people: unknown[] }>(MEMBER, 'people')).people.length;
    expect(overview.counts).toMatchObject({ teams: 1, activeTeams: 1, people: roster, unattributedEvents: 0 });
  });

  it('carries nothing that names another team', async () => {
    const { others, named } = await teams();
    expect(others.length).toBeGreaterThan(1);
    const paths = await memberReads();
    expect(paths.length).toBeGreaterThan(80);
    for (const path of paths) {
      const text = JSON.stringify(await read(MEMBER, path));
      expect(named.exec(text)?.[0], `GET ${path} names another team`).toBeUndefined();
    }
    // The same sweep finds those names in what a superadmin is answered, so it can fail.
    const fleet = JSON.stringify([await read(null, 'teams'), await read(null, 'people?scope=platform'), await read(null, 'initiatives?scope=platform')]);
    for (const t of others) expect(fleet).toContain(t.name);
  });

  it('answers another team\'s record as one that does not exist', async () => {
    // As the gateway does: a 403 would confirm the other team is real.
    const { others } = await teams();
    const other = others[0].slug;
    const theirs = (await read<{ initiatives: { team: string; slug: string }[] }>(null, `initiatives?team=${other}`)).initiatives[0];
    const node = (await read<{ nodes: { team: string; path: string }[] }>(null, 'knowledge?scope=platform')).nodes.find((n) => n.team === other)!;
    const doc = (await read<{ documents: { path: string }[] }>(null, `initiatives/${other}/${theirs.slug}`)).documents[0].path;
    for (const path of [`teams/${other}`, `initiatives/${other}/${theirs.slug}`, `document/${other}/${theirs.slug}/${doc}`,
                        `document/${other}/${theirs.slug}/${doc}?revision=1`, `knowledge/${other}/${node.path}`]) {
      expect((await ask(null, path)).status, `superadmin GET ${path}`).toBe(200);
      for (const scope of ['', `${path.includes('?') ? '&' : '?'}scope=platform`]) {
        const res = await ask(MEMBER, path + scope);
        expect(res.status, `member GET ${path}${scope}`).toBe(404);
        const never = await ask(MEMBER, (path + scope).replace(other, 'no-such-team'));
        expect(Object.keys(await res.json() as Json)).toEqual(Object.keys(await never.json() as Json));
      }
    }
  });

  it('refuses a team they are not in, and the platform\'s own settings', async () => {
    const { own, others } = await teams();
    const other = others[0].slug;
    expect((await ask(MEMBER, `initiatives?team=${other}`)).status).toBe(403);
    expect((await ask(MEMBER, `settings/team/members?team=${other}`)).status).toBe(403);
    expect((await ask(MEMBER, 'settings/platform/people')).status).toBe(403);
    expect((await ask(MEMBER, `settings/team/members?team=${own}`)).status).toBe(200);
    // A document of another team is not one their session can show or approve.
    const shown = await post(MEMBER, `documents/shown?team=${other}`, { initiative: 'i', path: 'spec.md', content_revision: 'cr_aaaaaaaaaaaaaaaaaaaaaaaaaa' });
    expect(shown.status).toBe(400);
  });

  it('holds their own settings, and writes as them', async () => {
    const [me, ava] = [await read<Me>(MEMBER, 'me'), await read<Me>(null, 'me')];
    const tokens = await read<{ label: string }[]>(MEMBER, 'settings/me/tokens');
    expect(tokens.length).toBeGreaterThan(0);
    expect(JSON.stringify(tokens)).not.toContain(ava.email);
    expect((await read<{ config: string }>(MEMBER, 'settings/me/client-setup')).config).toContain(me.email);
    expect(await read(MEMBER, 'settings/me/teams')).toMatchObject({ actingFor: me.activeTeam, teams: [{ team: me.activeTeam, role: 'admin', active: true }] });
    expect(JSON.stringify(await read(null, 'settings/me/tokens'))).toContain(ava.email);

    const issued = await post(MEMBER, 'settings/me/tokens', { label: 'laptop' });
    expect(await issued.json()).toMatchObject({ label: 'laptop', email: me.email });
    // A write still answers success and is forgotten.
    const revoked = await ask(MEMBER, `settings/me/tokens/${(tokens as unknown as { id: string }[])[0].id}`, { method: 'DELETE' });
    expect(revoked.status).toBe(200);
    expect(await read(MEMBER, 'settings/me/tokens')).toEqual(tokens);
  });

  it('searches as their own team, and shows and approves its documents', async () => {
    const me = await read<Me>(MEMBER, 'me');
    const found = await read<{ team: string; results: { team: string }[] }>(MEMBER, 'search?q=recency&scope=platform');
    expect(found.team).toBe(me.activeTeam);
    expect(found.results.length).toBeGreaterThan(0);
    for (const r of found.results) expect(r.team).toBe(me.activeTeam);
    // A superadmin who asks for the fleet's search is still refused: it has no fleet-wide reading.
    expect((await ask(null, 'search?q=recency&scope=platform')).status).toBe(400);

    const at = { initiative: '2026-09-28-search-relevance', path: 'plan.md' };
    const doc = await read<{ content_revision: string }>(MEMBER, `document/${me.activeTeam}/${at.initiative}/${at.path}`);
    const shown = await post(MEMBER, `documents/shown?team=${me.activeTeam}`, { ...at, content_revision: doc.content_revision });
    expect(shown.status).toBe(200);
    const { review_context } = await shown.json() as { review_context: string };
    expect((await post(MEMBER, `documents/approve?team=${me.activeTeam}`, { ...at, expected_revision: doc.content_revision, review_context })).status).toBe(200);
  });
});

type PeriodFigure = {
  window: { from: string; to: string; observedFrom: string | null; observedThrough: string | null; complete: boolean };
  figure: { value: number | null; why: string | null }; numerator: number | null; denominator: number | null;
};
type Need = { kind: string; title: string; detail: string; instanceCount: number; oldestAt: string | null; href: string | null; tone: string };
type Day = { date: string; calls: number; toolFailures: number; state: string; complete: boolean };
type Door = { door: string; days: Day[]; run: { days: number; atLeast: boolean; through: string } | null;
              totals: { calls: number; toolFailures: number; others: number; faultDays: number; lastFaultDay: string | null };
              finding: { kind: string; text: string } };
type Status = {
  meta: { asOf: string; timezone: string; period: { from: string; to: string }; scope: string; population: string; coverageFrom: string | null };
  needs: { state: string; rows: Need[]; total: number | null; knownCount: number; unavailableKinds: string[];
           overflowByKind: Record<string, number>; headline: string };
  measures: ({ key: string; weeks: PeriodFigure[]; better: string; judgement: string }
    & Record<'first' | 'best' | 'last' | 'previous' | 'highest' | 'lowest', PeriodFigure | null>)[];
  records: { state: string; data: { daysWithWork: number; daysUnderOnePercent: number; longestUnderOnePercent: { days: number; from: string; to: string } | null } };
  doors: { state: string; data: Door[] };
  running: { state: string; data: { platform: string; console: string | null; releasedAt: string; previous: string | null; migrations: number | null } };
  own: { state: string; data?: unknown };
};

describe('GET /api/console/platform/status', () => {
  it('answers both people the same public figure, and only the member\'s needs in their own projection', async () => {
    const [ava, noah] = [await read<Status>(null, 'platform/status'), await read<Status>(MEMBER, 'platform/status')];
    expect({ ...noah, needs: null }).toEqual({ ...ava, needs: null });
    expect(await read<Status>(SUPERADMIN, 'platform/status?scope=platform&team=beacon')).toEqual(ava);
    expect(ava.meta.scope).toBe('platform-public');
    expect(ava.meta.population).toMatch(/real-work/);
    expect(Number.isNaN(Date.parse(ava.meta.asOf))).toBe(false);
  });

  it('answers the eight measures in the spec\'s order, the first malformed calls per 1,000, whose weeks are the rate their own counts give', async () => {
    const { measures, meta } = await read<Status>(MEMBER, 'platform/status');
    expect(measures.map((m) => m.key)).toEqual(['malformed_per_1000', 'same_tool_followup_pct', 'call_p50_ms', 'call_p95_ms',
      'searches_with_results_pct', 'bugs_per_1000', 'sessions', 'work_finished']);
    // Every measure is drawn over the same weeks.
    for (const other of measures) expect(other.weeks.map((w) => w.window), other.key).toEqual(measures[0].weeks.map((w) => w.window));
    const [m] = measures;
    expect(m.weeks.length).toBeGreaterThanOrEqual(5);
    let withCalls = 0;
    for (const w of m.weeks) {
      expect(Number.isInteger(w.numerator) && Number.isInteger(w.denominator), JSON.stringify(w)).toBe(true);
      expect(w.numerator!).toBeLessThanOrEqual(w.denominator!);
      if (w.denominator! > 0) {
        withCalls++;
        expect(w.figure.value, JSON.stringify(w)).toBe((1000 * w.numerator!) / w.denominator!);
        // Under thirty calls the rate is kept and marked, never judged.
        expect(w.figure.why).toBe(w.denominator! < 30 ? 'insufficient' : null);
      } else {
        expect(w.figure).toEqual({ value: null, why: 'no_data' });
      }
    }
    expect(withCalls).toBeGreaterThanOrEqual(4);
    // The figures themselves, written out: the oldest week first, the running week last.
    expect(m.weeks.map((w) => [w.numerator, w.denominator, w.figure.value, w.figure.why])).toEqual([
      [10, 100, 100, null], [0, 0, null, 'no_data'], [3, 12, 250, 'insufficient'], [4, 200, 20, null], [8, 125, 64, null], [1, 5, 200, 'insufficient'],
    ]);

    // Monday to Monday in the reporting timezone, each week beginning where the one before ended.
    expect(meta.timezone).toBe('UTC');
    m.weeks.forEach((w, i) => {
      expect(new Date(w.window.from).getUTCDay(), w.window.from).toBe(1);
      expect(w.window.from).toMatch(/T00:00:00Z$/);
      expect(Date.parse(w.window.to) - Date.parse(w.window.from)).toBe(7 * 24 * 3_600_000);
      if (i) expect(w.window.from).toBe(m.weeks[i - 1].window.to);
      // Every week but the running one has ended and is wholly observed.
      expect(w.window.complete).toBe(i < m.weeks.length - 1);
    });
    const running = m.weeks.at(-1)!.window;
    expect(Date.parse(running.from)).toBeLessThanOrEqual(Date.parse(meta.asOf));
    expect(Date.parse(running.to)).toBeGreaterThan(Date.parse(meta.asOf));
    expect(running.observedThrough).toBe(meta.asOf);
    expect(meta.coverageFrom).toBe(m.weeks[0].window.from);
  });

  it('picks first, best, last and previous from whole weeks with enough calls, and they are never null here', async () => {
    const [m] = (await read<Status>(null, 'platform/status')).measures;
    const judged = m.weeks.filter((w) => w.window.complete && w.denominator! >= 30);
    expect(m.first).toEqual(judged[0]);
    expect(m.last).toEqual(judged.at(-1));
    expect(m.previous).toEqual(judged.at(-2));
    // Fewer malformed calls is better, so the best week is the lowest rate.
    expect(m.better).toBe('down');
    expect(m.best).toEqual([...judged].sort((a, b) => a.figure.value! - b.figure.value!)[0]);
    expect(m.last!.figure.value!).toBeGreaterThan(m.previous!.figure.value!);
    expect(m.judgement).toBe('worsened');
    expect([m.highest, m.lowest]).toEqual([null, null]);
  });

  it('answers what needs attention as the superadmin reads it: five rows at most, and the overflow, adding up to the total', async () => {
    const { needs } = await read<Status>(null, 'platform/status');
    expect(needs.state).toBe('complete');
    expect(needs.unavailableKinds).toEqual([]);
    expect(needs.rows.length).toBeLessThanOrEqual(5);
    const counted = needs.rows.reduce((n, r) => n + r.instanceCount, 0) + Object.values(needs.overflowByKind).reduce((n, v) => n + v, 0);
    expect(counted).toBe(needs.total);
    expect(needs.knownCount).toBe(needs.total);
    expect(needs.headline).toBe(`${needs.total} things need you`);
    // Worst first: every critical row before every warning, and the kinds in their order within each.
    const order = ['bugs', 'door', 'evaluation', 'approvals', 'drift'];
    const rank = (r: Need) => (r.tone === 'critical' ? 0 : 10) + order.indexOf(r.kind);
    expect(needs.rows.map(rank)).toEqual([...needs.rows.map(rank)].sort((a, b) => a - b));
    // Only a team's page is released: every other row links nowhere.
    for (const r of needs.rows) expect(r.href === null || /^\/teams\/[a-z0-9_-]+$/.test(r.href), JSON.stringify(r)).toBe(true);
    // A fault day today is one door's need, and the door's own days say so.
    const { doors } = await read<Status>(null, 'platform/status');
    for (const r of needs.rows.filter((x) => x.kind === 'door')) {
      const today = doors.data.find((d) => r.title.includes(` ${d.door} `))!.days.at(-1)!;
      expect(['marked', 'red']).toContain(today.state);
    }
  });

  it('answers a member what is known and open, every team\'s approvals folded into one row that names no team and links nowhere', async () => {
    const [ava, noah] = [(await read<Status>(null, 'platform/status')).needs, (await read<Status>(MEMBER, 'platform/status')).needs];
    expect(noah.total).toBe(ava.total);
    expect(noah.headline).toBe(`${noah.total} things are known and open`);
    const approvals = noah.rows.filter((r) => r.kind === 'approvals');
    expect(approvals).toHaveLength(1);
    expect(approvals[0].href).toBeNull();
    expect(approvals[0].instanceCount).toBe(ava.rows.filter((r) => r.kind === 'approvals').reduce((n, r) => n + r.instanceCount, 0)
      + (ava.overflowByKind.approvals ?? 0));
    expect(noah.overflowByKind.approvals).toBeUndefined();
    const counted = noah.rows.reduce((n, r) => n + r.instanceCount, 0) + Object.values(noah.overflowByKind).reduce((n, v) => n + v, 0);
    expect(counted).toBe(noah.total);
    for (const team of ['atlas', 'beacon']) expect(JSON.stringify(noah), team).not.toContain(team);
  });

  it('answers each door\'s days through today, its totals as their sums, its run and its finding', async () => {
    const { doors, meta } = await read<Status>(MEMBER, 'platform/status');
    expect(doors.state).toBe('ok');
    expect(doors.data.map((d) => d.door)).toEqual(['core', 'manage', 'eval']);
    for (const d of doors.data) {
      expect(d.days[0].date, d.door).toBe(meta.coverageFrom!.slice(0, 10));
      expect(d.days.at(-1)!.date, d.door).toBe(meta.asOf.slice(0, 10));
      d.days.forEach((x, i) => expect(x.complete, `${d.door} ${x.date}`).toBe(i < d.days.length - 1));
      expect(d.totals.calls).toBe(d.days.reduce((n, x) => n + x.calls, 0));
      expect(d.totals.toolFailures).toBe(d.days.reduce((n, x) => n + x.toolFailures, 0));
      // Fault days are complete days at 1% tool failures or more; today is shown apart, so far.
      const faults = d.days.filter((x) => x.complete && x.toolFailures * 100 >= x.calls && x.calls > 0);
      expect(d.totals.faultDays).toBe(faults.length);
      expect(d.totals.lastFaultDay).toBe(faults.at(-1)?.date ?? null);
      expect(d.finding.text).toBeTruthy();
      if (d.run) expect(d.run.through).toBe(d.days.at(-2)!.date);
    }
  });

  it('answers the records and what is running', async () => {
    const { records, running } = await read<Status>(MEMBER, 'platform/status');
    expect(records.state).toBe('ok');
    expect(records.data.daysUnderOnePercent).toBeLessThanOrEqual(records.data.daysWithWork);
    expect(records.data.longestUnderOnePercent!.days).toBeLessThanOrEqual(records.data.daysUnderOnePercent);
    expect(running.state).toBe('ok');
    expect(running.data.platform).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isNaN(Date.parse(running.data.releasedAt))).toBe(false);
  });

  it('answers the reader\'s own team\'s malformed calls, refusals put right, sessions and bug reports, over the measures\' weeks', async () => {
    const s = await read<Status>(MEMBER, 'platform/status');
    expect(s.own.state).toBe('ok');
    const own = s.own.data as { malformed: PeriodFigure[]; followup: PeriodFigure[]; sessions: PeriodFigure[]; bugs: Record<string, number> };
    for (const weeks of [own.malformed, own.followup, own.sessions]) {
      expect(weeks.map((w) => w.window)).toEqual(s.measures[0].weeks.map((w) => w.window));
    }
    // A team's own figures keep no sample minimum: a week with calls stands, its counts beside it.
    for (const w of own.malformed) expect(w.figure.why).toBe(w.denominator === 0 ? 'no_data' : null);
    expect(Object.keys(own.bugs).sort()).toEqual(['duplicate', 'filed', 'fixed', 'notABug', 'open']);
    expect(own.bugs.filed).toBe(own.bugs.fixed + own.bugs.notABug + own.bugs.duplicate + own.bugs.open);
  });

  it('is data the platform\'s own check can import with plain node', () => {
    // `checks/console-platform-status.ts` in zz-stack compares the real route's answer with this file's, by shape:
    // an import through the console's path alias would not resolve there, and a null has no shape to compare.
    const file = 'scripts/fake-gateway/platform-status.ts';
    expect(fs.readFileSync(file, 'utf8')).not.toMatch(/from '@\//);
    const out = execFileSync('node', ['-e', `import('./${file}').then((m) => console.log(JSON.stringify(m.PLATFORM_STATUS)))`], { encoding: 'utf8' });
    const served = JSON.parse(out) as Status;
    expect(served.measures.map((m) => m.key)).toEqual(PLATFORM_STATUS.measures.map((m) => m.key));
    for (const pick of ['first', 'best', 'last', 'previous'] as const) {
      expect(served.measures[0][pick], pick).toMatchObject({ window: expect.any(Object), figure: expect.any(Object) });
    }
  });

  it('still answers 404 for a route it does not have', async () => {
    for (const path of ['platform', 'platform/status/extra', 'platform/usage', 'no-such-route']) {
      for (const who of [null, MEMBER]) expect((await ask(who, path)).status, `GET ${path}`).toBe(404);
    }
  });
});

describe('POST /api/console/page-view', () => {
  it('accepts a known feature with nothing to say back', async () => {
    for (const who of [null, SUPERADMIN, MEMBER]) {
      for (const feature of ['home', 'initiatives', 'knowledge', 'people', 'settings', 'teams', 'plugins', 'runs', 'activity', 'platform-status']) {
        const res = await post(who, 'page-view', { feature });
        expect(res.status, `${who ?? 'no cookie'}: ${feature}`).toBe(204);
        expect(await res.text()).toBe('');
      }
    }
  });

  it('refuses a feature it does not know, and a body with none', async () => {
    for (const body of [{ feature: 'overview' }, { feature: '/initiatives/atlas/2026-09-28-search-relevance' }, { feature: '' },
                        { feature: 7 }, {}, [], 'not json', { workspace: 'main' }]) {
      const res = await post(MEMBER, 'page-view', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json() as { error: string }).error).toBeTruthy();
    }
  });
});

describe('the personas pnpm verify --as signs in as', () => {
  /** The rail today across both workspaces, in its own order (Work's, then Platform's); written out here and not read from `nav`. */
  const RAIL = ['/', '/teams', '/initiatives', '/knowledge', '/people', '/plugins', '/runs', '/activity', '/settings', '/platform'];

  it('are the superadmin and the member, each by the cookie the fixture reads', async () => {
    expect(Object.keys(personas).sort()).toEqual(['member', 'superadmin']);
    for (const p of Object.values(personas)) expect(p.cookie.name).toBe('zz_console');
    expect(await read<Me>(personas.superadmin.cookie.value, 'me')).toMatchObject({ role: 'superadmin', superadmin: true });
    expect(await read<Me>(personas.member.cookie.value, 'me')).toMatchObject({ role: 'member', superadmin: false });
    expect([SUPERADMIN, MEMBER]).not.toContain(NO_SESSION);
  });

  it('expect the rail each is shown today', () => {
    expect([...personas.superadmin.expectedRoutes]).toEqual(RAIL);
    expect([...personas.member.expectedRoutes]).toEqual(['/', '/initiatives', '/knowledge', '/people', '/settings', '/platform']);
    expect(personas.superadmin.deniedProbe).toBeUndefined();
  });

  it('probe a page the member is refused for a string that is another team\'s, and the fixture holds', async () => {
    const { others } = await teams();
    const probes = Object.entries(personas.member.deniedProbe ?? {});
    expect(probes.length).toBeGreaterThan(0);
    for (const [route, probe] of probes) {
      expect(RAIL, route).toContain(route);
      expect(personas.member.expectedRoutes, route).not.toContain(route);
      expect(others.some((t) => probe.includes(t.name) || probe.includes(t.slug)), probe).toBe(true);
      // The page's own read holds it for the superadmin, and not for the member.
      const collection = route.slice(1);
      expect(JSON.stringify(await read(null, `${collection}?scope=platform`))).toContain(probe);
      expect(JSON.stringify(await read(MEMBER, `${collection}?scope=platform`))).not.toContain(probe);
    }
  });
});
