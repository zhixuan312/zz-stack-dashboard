// @vitest-environment node
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MEMBER_STATUS, PLATFORM_STATUS } from '../scripts/fake-gateway/platform-status.ts';
import config from '../scripts/verify.config.ts';

/**
 * Platform's reads and the resolve write, as the fake gateway answers them to the superadmin and to a member.
 *
 * The key sets below are written out from the shapes the gateway's tasks declare and never read from the fixture, so
 * a field the fake adds or drops fails here before the platform's own checks compare it with the real routes. What a
 * member may read is the public projection: the same rows as the superadmin's, less what only the superadmin is given.
 */
type Json = Record<string, any>;

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

/** One request as the person a cookie value names; `null` sends no cookie, which is the superadmin. */
const ask = (who: string | null, path: string, init: RequestInit = {}) => fetch(`${base}/api/console/${path}`, {
  ...init, headers: { ...(init.headers as Record<string, string>), ...(who === null ? {} : { cookie: `zz_console=${who}` }) },
});
const read = async (who: string | null, path: string): Promise<Json> => {
  const res = await ask(who, path);
  expect(res.status, `${who ?? 'no cookie'} GET ${path}`).toBe(200);
  return res.json();
};
const resolveAs = (who: string | null, id: string, body: unknown) => ask(who, `platform/bugs/${id}/resolve`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const keys = (o: object) => Object.keys(o).sort();

const META = ['asOf', 'coverageFrom', 'period', 'population', 'scope', 'timezone'];
const FIGURE = ['value', 'why'];
const WINDOW = ['complete', 'from', 'observedFrom', 'observedThrough', 'to'];
const RELEASE_ROW = ['after', 'before', 'clientAction', 'consoleVersion', 'releasedAt', 'summary', 'version'];
const RELEASE_WINDOW = ['calls', 'malformed', 'malformedPer1000', 'overlappingVersions', 'p95Ms', 'toolFailures', 'window'];
const PUBLIC_BUG = ['filedAt', 'id', 'impact', 'platformVersion', 'resolvedAt', 'status', 'surface', 'title'];
const ADMIN_BUG = [...PUBLIC_BUG, 'internalTitle', 'team'].sort();
const BUG_REPORT = ['detail', 'duplicateOf', 'id', 'impact', 'platformVersion', 'reportedAt', 'resolution', 'resolvedAt', 'status', 'surface', 'team', 'title'];
const SAFE_FINDING = ['id', 'kind', 'measure', 'owner', 'plugin', 'summary', 'waitingSince'];

/** The reports as the superadmin's queue lists them, every one of them on one page. */
const allBugs = async (who: string | null) => (await read(who, 'platform/bugs?limit=100')).queue.data.rows as Json[];

/** Every team's slug and name, and every persona's email and name, as whole words: none may reach a refusal. */
async function names(): Promise<RegExp> {
  const teams = (await read(null, 'teams?scope=platform')).teams as { slug: string; name: string }[];
  const people = [await read(SUPERADMIN, 'me'), await read(MEMBER, 'me')];
  const words = [...teams.flatMap((t) => [t.slug, t.name]), ...people.flatMap((p) => [p.email, p.name]), 'superadmin', 'admin', 'member', 'role']
    .map((w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${words.join('|')})\\b`, 'i');
}

describe('GET /api/console/platform/releases', () => {
  it('answers both people the same releases in the declared shape, whatever they ask for', async () => {
    const ava = await read(null, 'platform/releases');
    expect(await read(MEMBER, 'platform/releases?scope=platform&team=beacon')).toEqual(ava);
    expect(await read(SUPERADMIN, 'platform/releases')).toEqual(ava);
    expect(keys(ava)).toEqual(['meta', 'rows', 'tiles', 'weeks']);
    expect(keys(ava.meta)).toEqual(META);
    expect(ava.meta.scope).toBe('platform-public');
    expect(keys(ava.tiles)).toEqual(['lastWeek', 'latest', 'migrations', 'releases']);
    expect(keys(ava.tiles.latest)).toEqual(['releasedAt', 'version']);
    expect(keys(ava.tiles.migrations)).toEqual(['applied', 'lastAt']);
    for (const w of ava.weeks) {
      expect(keys(w)).toEqual(['malformedPer1000', 'releases', 'window']);
      expect(keys(w.window)).toEqual(WINDOW);
    }
    expect(ava.rows.state).toBe('ok');
    expect(keys(ava.rows.data)).toEqual(['rows', 'total']);
    for (const r of ava.rows.data.rows) {
      expect(keys(r)).toEqual(RELEASE_ROW);
      for (const side of [r.before, r.after]) {
        expect(keys(side)).toEqual(RELEASE_WINDOW);
        expect(keys(side.window)).toEqual(WINDOW);
        for (const f of [side.calls, side.malformed, side.malformedPer1000, side.toolFailures, side.p95Ms]) expect(keys(f)).toEqual(FIGURE);
      }
    }
  });

  it('reads the weekly malformed-call rate exactly as Status does', async () => {
    const { weeks } = await read(MEMBER, 'platform/releases');
    expect(weeks.map((w: Json) => w.malformedPer1000)).toEqual((await read(MEMBER, 'platform/status')).measures[0].weeks);
    expect(weeks.reduce((n: number, w: Json) => n + w.releases, 0)).toBeGreaterThan(0);
  });

  it('holds every state the page draws', async () => {
    const { meta, rows: { data: { rows } } } = await read(MEMBER, 'platform/releases');
    const at = (v: string) => rows.find((r: Json) => r.version === v);
    expect(rows.map((r: Json) => r.releasedAt)).toEqual([...rows.map((r: Json) => r.releasedAt)].sort().reverse());
    // Released inside 72 hours: the after-window is still running, observed through the read's cutoff and no further.
    const newest = rows[0];
    expect(newest.after.window).toMatchObject({ complete: false, observedThrough: meta.asOf });
    expect(Date.parse(newest.after.window.to)).toBeGreaterThan(Date.parse(meta.asOf));
    // Two releases inside one window name each other.
    const overlapping = rows.filter((r: Json) => r.before.overlappingVersions.length || r.after.overlappingVersions.length);
    expect(overlapping.length).toBeGreaterThanOrEqual(2);
    for (const r of overlapping) {
      for (const v of [...r.before.overlappingVersions, ...r.after.overlappingVersions]) {
        const other = at(v);
        expect([...other.before.overlappingVersions, ...other.after.overlappingVersions], `${v} names ${r.version}`).toContain(r.version);
      }
    }
    // A full window on both sides.
    expect(rows.some((r: Json) => r.before.window.complete && r.after.window.complete)).toBe(true);
    // A window with no calls has no rate and no latency, never a zero.
    const silent = rows.find((r: Json) => r.after.calls.value === 0);
    expect(silent.after.malformedPer1000).toEqual({ value: null, why: 'no_data' });
    expect(silent.after.p95Ms).toEqual({ value: null, why: 'no_data' });
    // A tag with no changelog section, released before the record began: its before-window was never observed.
    const untold = rows.find((r: Json) => r.summary === 'No changelog entry');
    expect(untold.clientAction).toBe('Unknown — no recorded upgrade notes');
    expect(untold.before.window).toMatchObject({ observedFrom: null, observedThrough: null, complete: false });
    for (const f of [untold.before.calls, untold.before.malformedPer1000, untold.before.p95Ms]) expect(f).toEqual({ value: null, why: 'unavailable' });
    expect(untold.after.window.observedFrom).toBe(meta.coverageFrom);
    expect(untold.after.window.complete).toBe(false);
  });

  it('pages its rows, 10 by default and at most 100', async () => {
    const all = (await read(null, 'platform/releases')).rows.data;
    const second = (await read(null, 'platform/releases?limit=2&offset=2')).rows.data;
    expect(second.total).toBe(all.total);
    expect(second.rows).toEqual(all.rows.slice(2, 4));
    for (const q of ['limit=0', 'limit=101', 'limit=2.5', 'offset=-1', 'limit=ten']) expect((await ask(MEMBER, `platform/releases?${q}`)).status, q).toBe(400);
  });

  it('opens a release with its changelog and upgrade notes, and an unknown version is a 404 that says nothing', async () => {
    const rows = (await read(null, 'platform/releases')).rows.data.rows as Json[];
    for (const r of rows) {
      const detail = await read(MEMBER, `platform/releases/${r.version}`);
      expect(keys(detail)).toEqual([...RELEASE_ROW, 'changelog', 'upgradeNotes'].sort());
      expect(detail).toMatchObject(r);
      expect(await read(null, `platform/releases/${r.version}`)).toEqual(detail);
    }
    expect((await read(null, `platform/releases/${rows.find((r) => r.clientAction === 'Re-pull the plugins.')!.version}`)).upgradeNotes).toMatch(/Re-pull/);
    for (const who of [null, MEMBER]) {
      const res = await ask(who, 'platform/releases/9.9.9');
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    }
  });
});

describe('GET /api/console/platform/bugs', () => {
  it('answers the superadmin the internal queue and a member the public projection of the same reports', async () => {
    const [ava, noah] = [await read(null, 'platform/bugs?limit=100'), await read(MEMBER, 'platform/bugs?limit=100')];
    for (const b of [ava, noah]) {
      expect(keys(b)).toEqual(['cohorts', 'counts', 'medianResolveHours', 'meta', 'oldestOpenAt', 'queue']);
      expect(keys(b.meta)).toEqual(META);
      expect(keys(b.counts.data)).toEqual(['byImpact', 'byStatus', 'open', 'resolved']);
      expect(keys(b.counts.data.byImpact)).toEqual(['blocks_work', 'confusing', 'cosmetic', 'wrong_result']);
      expect(keys(b.counts.data.byStatus)).toEqual(['duplicate', 'fixed', 'not_a_bug', 'open']);
      expect(keys(b.medianResolveHours)).toEqual(FIGURE);
      for (const c of b.cohorts) expect(keys(c)).toEqual(['filed', 'filedPer1000', 'medianResolveHours', 'resolved', 'stillOpen', 'week']);
    }
    expect([ava.meta.scope, noah.meta.scope]).toEqual(['platform-admin', 'platform-public']);
    // The same figures for both; only the queue's rows differ, and only by what the superadmin is given.
    const { meta: _a, queue: qa, ...figures } = ava;
    const { meta: _n, queue: qn, ...same } = noah;
    expect(same).toEqual(figures);
    expect(qn.data.total).toBe(qa.data.total);
    for (const r of qa.data.rows) expect(keys(r)).toEqual(ADMIN_BUG);
    for (const r of qn.data.rows) expect(keys(r)).toEqual(PUBLIC_BUG);
    expect(qn.data.rows).toEqual(qa.data.rows.map(({ internalTitle: _t, team: _team, ...row }: Json) => row));
    expect(await read(MEMBER, 'platform/bugs?limit=100&scope=platform&team=beacon')).toEqual(noah);
  });

  it('titles a report from its canonical surface alone, and never echoes free text', async () => {
    const rows = await allBugs(null);
    for (const r of rows) {
      expect(r.title).toBe(r.surface === null ? 'Platform issue reported' : `Report concerning ${r.surface}`);
      if (r.surface !== null) expect(r.surface).toMatch(/^[a-z_]+$/);
    }
    // A surface outside the vocabulary, and a report with a surface in a door's own spelling, both appear.
    expect(rows.filter((r) => r.title === 'Platform issue reported').length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.surface === 'document_approve')).toBe(true);
    // What the superadmin reads in a report is nowhere in what a member is answered.
    const text = JSON.stringify(await read(MEMBER, 'platform/bugs?limit=100'));
    for (const r of rows) {
      const report = await read(null, `platform/bugs/${r.id}`);
      for (const secret of [report.title, report.detail, report.resolution].filter(Boolean)) expect(text).not.toContain(secret);
      if (report.surface && r.surface === null) expect(text).not.toContain(report.surface);
    }
    expect((await names()).exec(text)?.[0]).toBeUndefined();
  });

  it('holds every state the page draws', async () => {
    const b = await read(MEMBER, 'platform/bugs?limit=100');
    const rows = b.queue.data.rows as Json[];
    expect(rows.some((r) => r.status === 'open' && r.impact === 'blocks_work')).toBe(true);
    expect(b.cohorts.some((c: Json) => c.stillOpen.value > 0 && c.filed.value > c.stillOpen.value)).toBe(true);
    expect(b.cohorts.some((c: Json) => c.filed.value > 0 && c.medianResolveHours.value === null)).toBe(true);
    expect(b.counts.data.open + b.counts.data.resolved).toBe(rows.length);
    expect(b.oldestOpenAt).toBe(rows.filter((r) => r.status === 'open').map((r) => r.filedAt).sort()[0]);
    for (const status of ['open', 'fixed', 'not_a_bug', 'duplicate']) expect(rows.some((r) => r.status === status), status).toBe(true);
    // Newest first, the id breaking a tie.
    expect(rows.map((r) => r.filedAt)).toEqual([...rows.map((r) => r.filedAt)].sort().reverse());
  });

  it('filters and pages on the server, and refuses a value it does not know', async () => {
    const all = await allBugs(MEMBER);
    expect((await read(MEMBER, 'platform/bugs?state=open&limit=100')).queue.data.rows).toEqual(all.filter((r) => r.status === 'open'));
    expect((await read(MEMBER, 'platform/bugs?state=resolved&limit=100')).queue.data.rows).toEqual(all.filter((r) => r.status !== 'open'));
    expect((await read(MEMBER, 'platform/bugs?impact=cosmetic&limit=100')).queue.data.rows).toEqual(all.filter((r) => r.impact === 'cosmetic'));
    expect((await read(MEMBER, 'platform/bugs?surface=document_approve&limit=100')).queue.data.rows).toEqual(all.filter((r) => r.surface === 'document_approve'));
    const page = (await read(MEMBER, 'platform/bugs?limit=3&offset=3')).queue.data;
    expect([page.rows, page.total]).toEqual([all.slice(3, 6), all.length]);
    expect((await read(MEMBER, 'platform/bugs')).queue.data.rows).toHaveLength(Math.min(10, all.length));
    for (const q of ['state=closed', 'impact=severe', 'surface=the%20search%20page', 'limit=101', 'offset=-2']) {
      expect((await ask(MEMBER, `platform/bugs?${q}`)).status, q).toBe(400);
    }
  });
});

describe('the superadmin\'s bug routes', () => {
  it('answer a report and its duplicate targets to the superadmin', async () => {
    const rows = await allBugs(null);
    for (const r of rows) {
      const report = await read(null, `platform/bugs/${r.id}`);
      expect(keys(report)).toEqual(BUG_REPORT);
      expect([report.id, report.title, report.team, report.reportedAt]).toEqual([r.id, r.internalTitle, r.team, r.filedAt]);
      const { rows: targets } = await read(SUPERADMIN, `platform/bugs/${r.id}/duplicates`);
      for (const t of targets) {
        expect(keys(t)).toEqual(['id', 'reportedAt', 'status', 'title']);
        // Only what bug_resolve would accept: another report of the same team, no team matching no team.
        expect(t.id).not.toBe(r.id);
        expect(rows.find((x) => x.id === t.id)!.team).toBe(r.team);
      }
    }
    const duplicate = await read(null, `platform/bugs/${rows.find((r) => r.status === 'duplicate')!.id}`);
    expect(rows.find((r) => r.id === duplicate.duplicateOf)!.team).toBe(duplicate.team);
  });

  it('refuse a member before anything is read, with nothing in the refusal that names anyone', async () => {
    const named = await names();
    const id = (await allBugs(null))[0].id;
    const tries: [string, RequestInit][] = [
      [`platform/bugs/${id}`, {}], [`platform/bugs/${id}/duplicates`, {}], ['platform/bugs/no-such-report', {}],
      ['platform/bugs/00000000-0000-4000-8000-000000000000/duplicates', {}],
      [`platform/bugs/${id}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'fixed', resolution: 'Done.' }) }],
    ];
    for (const [path, init] of tries) {
      const res = await ask(MEMBER, path, init);
      expect(res.status, path).toBe(403);
      const body = await res.text();
      expect(named.exec(body)?.[0], `${path}: ${body}`).toBeUndefined();
      expect(body).not.toContain(id);
    }
  });

  it('answer an id that names no report with a 404 that says nothing', async () => {
    for (const path of ['platform/bugs/00000000-0000-4000-8000-000000000000', 'platform/bugs/not-a-uuid',
                        'platform/bugs/00000000-0000-4000-8000-000000000000/duplicates']) {
      const res = await ask(null, path);
      expect(res.status, path).toBe(404);
      expect(await res.text()).toBe('');
    }
    const res = await resolveAs(null, '00000000-0000-4000-8000-000000000000', { status: 'fixed', resolution: 'Done.' });
    expect([res.status, await res.text()]).toEqual([404, '']);
  });
});

describe('POST /api/console/platform/bugs/:id/resolve', () => {
  it('answers 204 with nothing to say back, and forgets the write', async () => {
    const rows = await allBugs(null);
    const open = rows.find((r) => r.status === 'open')!;
    const sibling = rows.find((r) => r.id !== open.id && r.team === open.team)!;
    for (const body of [{ status: 'fixed', resolution: 'Fixed in the next release.' }, { status: 'not_a_bug', resolution: 'Working as designed.' },
                        { status: 'duplicate', resolution: 'Same cause.', duplicate_of: sibling.id }]) {
      const res = await resolveAs(SUPERADMIN, open.id, body);
      expect(res.status, JSON.stringify(body)).toBe(204);
      expect(await res.text()).toBe('');
    }
    expect((await read(null, `platform/bugs/${open.id}`)).status).toBe('open');
  });

  it('answers 409 with the first decision for a report already closed, and 400 with zz-core\'s sentence otherwise', async () => {
    const rows = await allBugs(null);
    const open = rows.find((r) => r.status === 'open')!;
    const closed = rows.find((r) => r.status === 'fixed')!;
    const conflict = await resolveAs(null, closed.id, { status: 'not_a_bug', resolution: 'Second thoughts.' });
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error).toMatch(/^ERROR: that report was already closed as `fixed`/);
    const foreign = rows.find((r) => r.team !== open.team)!;
    for (const body of [{ status: 'fixed', resolution: '   ' }, { status: 'fixed' }, { status: 'reopened', resolution: 'No.' },
                        { status: 'duplicate', resolution: 'Same.' }, { status: 'duplicate', resolution: 'Same.', duplicate_of: open.id },
                        { status: 'duplicate', resolution: 'Same.', duplicate_of: '00000000-0000-4000-8000-000000000000' },
                        { status: 'duplicate', resolution: 'Same.', duplicate_of: foreign.id },
                        { status: 'fixed', resolution: 'Done.', duplicate_of: foreign.id }]) {
      const res = await resolveAs(null, open.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).error, JSON.stringify(body)).toBeTruthy();
    }
  });
});

describe('GET /api/console/platform/evaluation', () => {
  it('answers the declared shape to both people, a member without the owning team\'s keys or a finding\'s pattern', async () => {
    const [ava, noah] = [await read(null, 'platform/evaluation'), await read(MEMBER, 'platform/evaluation?scope=platform&team=beacon')];
    for (const e of [ava, noah]) {
      expect(keys(e)).toEqual(['byDecision', 'byOwner', 'history', 'meta', 'plugins', 'tiles', 'waiting']);
      expect(keys(e.meta)).toEqual(META);
      expect(keys(e.tiles)).toEqual(['daysScored', 'established', 'lastScored', 'waiting']);
      for (const p of e.plugins.data) {
        expect(keys(p)).toEqual(['guardrails', 'lower', 'plugin', 'protocol', 'score', 'scoredAt', 'standing', 'upper']);
        expect(keys(p.score)).toEqual(FIGURE);
        expect(keys(p.protocol)).toEqual(['key', 'version']);
      }
      for (const h of e.history.data) {
        expect(keys(h)).toEqual(['plugin', 'series', 'statement']);
        for (const s of h.series) {
          expect(keys(s)).toEqual(['population', 'protocol', 'runs']);
          for (const r of s.runs) expect(keys(r)).toEqual(['lower', 'score', 'scoredAt', 'standing', 'upper']);
        }
      }
      expect(keys(e.byDecision.data)).toEqual(['applied', 'deferred', 'rejected']);
      expect(keys(e.waiting.data)).toEqual(['rows', 'total']);
    }
    for (const r of ava.waiting.data.rows) expect(keys(r)).toEqual([...SAFE_FINDING, 'pattern'].sort());
    for (const r of noah.waiting.data.rows) expect(keys(r)).toEqual(SAFE_FINDING);
    expect([ava.meta.scope, noah.meta.scope]).toEqual(['platform-admin', 'platform-public']);
    // The member's answer is the superadmin's with the keys and patterns taken out, and nothing else changed.
    const strip = (e: Json) => JSON.parse(JSON.stringify({ ...e, meta: null }, (k, v) => (k === 'pattern' ? undefined : k === 'key' || k === 'measure' ? null : v)));
    expect(strip(noah)).toEqual(strip(ava));
    expect(JSON.stringify(noah)).not.toMatch(/"(key|measure)":"/);
    for (const r of ava.waiting.data.rows) expect(JSON.stringify(noah)).not.toContain(r.pattern);
    expect(ava.plugins.data.every((p: Json) => typeof p.protocol.key === 'string')).toBe(true);
  });

  it('holds every state the page draws', async () => {
    const e = await read(MEMBER, 'platform/evaluation');
    const statements = e.history.data.map((h: Json) => h.statement);
    expect(statements).toContain('Comparable: one protocol version and population');
    expect(statements).toContain('Not comparable: a different protocol version');
    expect(statements).toContain('Not comparable: a different population');
    // A trend: two runs on different dates in one series.
    expect(e.history.data.some((h: Json) => h.series.some((s: Json) => new Set(s.runs.map((r: Json) => r.scoredAt.slice(0, 10))).size > 1))).toBe(true);
    expect(e.plugins.data.some((p: Json) => p.standing === 'not_established' && p.score.value === null)).toBe(true);
    // Findings waiting, oldest first, each read by its fixed summary.
    const waiting = e.waiting.data.rows as Json[];
    expect(waiting.length).toBeGreaterThan(0);
    expect(e.tiles.waiting).toBe(e.waiting.data.total);
    expect(waiting.map((r) => r.waitingSince)).toEqual([...waiting.map((r) => r.waitingSince)].sort());
    for (const r of waiting) {
      expect(r.summary).toBe(r.owner === 'unknown' ? 'Evaluation finding awaiting a decision' : `A finding on ${r.plugin}, owned by ${r.owner}, awaiting a decision`);
    }
    expect(waiting.some((r) => r.owner === 'unknown')).toBe(true);
    expect(e.byDecision.data.deferred).toBe(waiting.length);
  });
});

describe('the fake gateway beside Platform\'s new routes', () => {
  it('leaves the status answer exactly as its fixture holds it', async () => {
    // The fixture's times are offsets from the moment its process started, so the server's and this one's differ.
    const untimed = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) ? 'time' : x)));
    expect(untimed(await read(null, 'platform/status'))).toEqual(untimed(PLATFORM_STATUS));
    expect(untimed(await read(MEMBER, 'platform/status'))).toEqual(untimed(MEMBER_STATUS));
  });

  it('still answers 404 for a Platform route it does not have', async () => {
    for (const path of ['platform', 'platform/status/extra', 'platform/releases/0.96.0/notes', 'platform/bugs/x/y/z', 'platform/evaluation/sdlc', 'platform/usage']) {
      for (const who of [null, MEMBER]) expect((await ask(who, path)).status, `GET ${path}`).toBe(404);
    }
  });

  it('keeps its fixtures as data the platform\'s checks can import with plain node', () => {
    for (const [file, name] of [['platform-releases', 'RELEASES'], ['platform-bugs', 'REPORTS'], ['platform-evaluation', 'evaluation']]) {
      const path = `scripts/fake-gateway/${file}.ts`;
      expect(fs.readFileSync(path, 'utf8')).not.toMatch(/from '@\//);
      const out = execFileSync('node', ['-e', `import('./${path}').then((m) => console.log(typeof m.${name}))`], { encoding: 'utf8' });
      expect(out.trim(), path).not.toBe('undefined');
    }
  });

  it('names each new route in a tracked file, which is where the platform\'s gate looks for a caller', () => {
    // `scripts/gate/checks/console.ts` in zz-stack greps this checkout for each route's path up to its first parameter.
    const source = fs.readFileSync('scripts/fake-gateway/server.ts', 'utf8');
    for (const route of ['/platform/releases', '/platform/bugs', '/platform/evaluation']) expect(source).toContain(route);
  });
});
