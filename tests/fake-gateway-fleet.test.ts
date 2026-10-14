// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../scripts/verify.config.ts';

/**
 * Fleet's reads as the fake gateway answers them: Teams, a team and People to the superadmin, Usage and Knowledge health
 * to both people, and Audit to the superadmin with a member refused. What a member is answered for Teams and People is
 * asserted in fake-gateway-fleet-member.test.ts.
 *
 * The key sets below are written out from the shapes the gateway's tasks declare and never read from the fixture, so
 * a field the fake adds or drops fails here before the platform's own checks compare it with the real routes. A
 * member's Usage and Knowledge health are the superadmin's less what only the superadmin is given, so each is compared
 * with the superadmin's rather than with values written twice.
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
const ask = (who: string | null, path: string) => fetch(`${base}/api/console/${path}`, { headers: who === null ? {} : { cookie: `zz_console=${who}` } });
const read = async (who: string | null, path: string): Promise<Json> => {
  const res = await ask(who, path);
  expect(res.status, `${who ?? 'no cookie'} GET ${path}`).toBe(200);
  return res.json();
};
const keys = (o: object) => Object.keys(o).sort();
const sorted = (...k: string[]) => k.sort();

const META = ['asOf', 'coverageFrom', 'period', 'population', 'scope', 'timezone'];
const FIGURE = ['value', 'why'];
const WINDOW = ['complete', 'from', 'observedFrom', 'observedThrough', 'to'];
const PERIOD = ['denominator', 'figure', 'numerator', 'window'];
const TODAY_TEAM = ['created', 'documents', 'initiatives', 'knowledge', 'members', 'name', 'slug', 'sources', 'status'];
const TEAM_ROW = sorted(...TODAY_TEAM, 'calls', 'lastActive', 'lessons', 'openWork', 'people', 'sessions', 'waiting');
const TODAY_PERSON = ['activeTeam', 'active_team', 'created', 'email', 'last_used', 'name', 'role', 'status', 'teams', 'tokens'];
const PERSON_ROW = sorted(...TODAY_PERSON, 'lastSignIn', 'passkeys', 'state');
const AUDIT_ROW = ['actor', 'at', 'id', 'inConsole', 'kind', 'ok', 'origin', 'refusalOwner', 'sentence', 'subject', 'team'];

const isPeriod = (p: Json) => { expect(keys(p)).toEqual(PERIOD); expect(keys(p.window)).toEqual(WINDOW); expect(keys(p.figure)).toEqual(FIGURE); };
const ok = (part: Json) => { expect(part.state).toBe('ok'); return part.data; };

describe('GET /api/console/teams, the superadmin\'s', () => {
  it('answers the tiles and every team in the declared shape, today\'s fields kept', async () => {
    const ava = await read(SUPERADMIN, 'teams');
    expect(await read(null, 'teams?scope=platform')).toEqual(ava);
    expect(keys(ava)).toEqual(['meta', 'teams', 'tiles', 'total']);
    expect(keys(ava.meta)).toEqual(META);
    expect(ava.meta.scope).toBe('platform-admin');
    expect(keys(ava.tiles)).toEqual(['lessons', 'openWork', 'pending', 'teams']);
    expect(ava.total).toBe(ava.teams.length);
    for (const t of ava.teams) {
      expect(keys(t)).toEqual(TEAM_ROW);
      for (const w of t.sessions) isPeriod(w);
      expect(keys(t.calls)).toEqual(['last', 'previous']);
      isPeriod(t.calls.last);
      isPeriod(t.calls.previous);
      expect(t.calls.last.window.complete).toBe(true);
      expect(t.sessions.at(-1).window.complete).toBe(false);
    }
    const sum = (k: string) => ava.teams.reduce((n: number, t: Json) => n + t[k], 0);
    expect(ava.tiles).toEqual({ teams: ava.total, openWork: sum('openWork'), pending: sum('waiting'), lessons: sum('lessons') });
  });

  it('holds the states the page draws, newest activity first and a team with none last', async () => {
    const { teams } = await read(SUPERADMIN, 'teams');
    expect(teams.length).toBeGreaterThan(4);
    const active = teams.map((t: Json) => t.lastActive).filter((a: string | null) => a !== null);
    expect(active).toEqual([...active].sort().reverse());
    expect(teams.at(-1).lastActive).toBeNull();
    expect(teams.some((t: Json) => t.status === 'archived')).toBe(true);
    expect(teams.some((t: Json) => t.waiting > 0)).toBe(true);
    expect(teams.filter((t: Json) => t.calls.last.figure.value > 0).length).toBeGreaterThan(3);
  });

  it('filters by q and status, and pages, 10 by default and at most 100', async () => {
    const { teams } = await read(SUPERADMIN, 'teams');
    const archived = await read(SUPERADMIN, 'teams?status=archived');
    expect(archived.teams.map((t: Json) => t.slug)).toEqual(teams.filter((t: Json) => t.status === 'archived').map((t: Json) => t.slug));
    expect(archived.tiles).toEqual((await read(SUPERADMIN, 'teams')).tiles);
    const named = await read(SUPERADMIN, `teams?q=${encodeURIComponent(teams[1].name.toUpperCase())}`);
    expect(named.teams.map((t: Json) => t.slug)).toEqual([teams[1].slug]);
    const page = await read(SUPERADMIN, 'teams?limit=2&offset=1');
    expect(page.teams).toEqual(teams.slice(1, 3));
    expect(page.total).toBe(teams.length);
    for (const bad of ['teams?status=gone', 'teams?limit=0', 'teams?limit=101', 'teams?offset=-1']) expect((await ask(SUPERADMIN, bad)).status, bad).toBe(400);
  });

  it('answers a team\'s page with its own values of the list\'s fields, and a slug no team has as 404 with nothing in it', async () => {
    const { teams } = await read(SUPERADMIN, 'teams');
    for (const row of teams) {
      const t = await read(SUPERADMIN, `teams/${row.slug}`);
      expect(keys(t)).toEqual(['calls', 'counts', 'members', 'meta', 'team', 'tiles']);
      expect(keys(t.meta)).toEqual(META);
      expect(t.team).toEqual({ slug: row.slug, name: row.name, status: row.status, created: row.created });
      expect(t.counts).toEqual({ members: row.members, initiatives: row.initiatives, documents: row.documents, sources: row.sources, knowledge: row.knowledge });
      expect(t.tiles).toEqual({ people: row.people, openWork: row.openWork, waiting: row.waiting, lessons: row.lessons });
      expect(t.members).toHaveLength(row.members);
      for (const m of t.members) expect(keys(m)).toEqual(['email', 'joined', 'name', 'role']);
      for (const w of t.calls) isPeriod(w);
      expect(t.calls.at(-2)).toEqual(row.calls.last);
    }
    const unknown = await ask(SUPERADMIN, 'teams/no-such-team');
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toBe('');
  });
});

describe('GET /api/console/people, the superadmin\'s', () => {
  it('answers the tiles and every person in the declared shape, today\'s fields kept', async () => {
    const ava = await read(SUPERADMIN, 'people');
    expect(await read(null, 'people?scope=platform')).toEqual(ava);
    expect(keys(ava)).toEqual(['meta', 'people', 'tiles', 'total']);
    expect(keys(ava.meta)).toEqual(META);
    expect(keys(ava.tiles)).toEqual(['neverSignedIn', 'people', 'signInsLastWeek', 'withPasskey']);
    isPeriod(ava.tiles.signInsLastWeek);
    expect(ava.tiles.signInsLastWeek.window.complete).toBe(true);
    expect(ava.total).toBe(ava.people.length);
    for (const p of ava.people) expect(keys(p)).toEqual(PERSON_ROW);
    expect(ava.tiles.people).toBe(ava.total);
    expect(ava.tiles.withPasskey).toBe(ava.people.filter((p: Json) => p.passkeys > 0).length);
    expect(ava.tiles.neverSignedIn).toBe(ava.people.filter((p: Json) => p.state === 'active' && p.lastSignIn === null).length);
    expect(ava.people.map((p: Json) => `${p.created} ${p.email}`)).toEqual(ava.people.map((p: Json) => `${p.created} ${p.email}`).sort());
  });

  it('holds a deactivated person, and a person never signed in whose sign-in is null rather than a date', async () => {
    const { people } = await read(SUPERADMIN, 'people');
    const gone = people.find((p: Json) => p.state === 'deactivated');
    expect(gone.status).toBe('deactivated');
    expect(gone.lastSignIn).not.toBeNull();
    const never = people.find((p: Json) => p.state === 'active' && p.lastSignIn === null);
    expect(never.passkeys).toBe(0);
    expect(people.some((p: Json) => p.teams.length > 1)).toBe(true);
  });

  it('filters by q and state, and pages', async () => {
    const { people } = await read(SUPERADMIN, 'people');
    expect((await read(SUPERADMIN, 'people?state=deactivated')).people.map((p: Json) => p.email))
      .toEqual(people.filter((p: Json) => p.state === 'deactivated').map((p: Json) => p.email));
    expect((await read(SUPERADMIN, `people?q=${encodeURIComponent(people[2].name.split(' ')[0].toLowerCase())}`)).people.map((p: Json) => p.email)).toContain(people[2].email);
    const page = await read(SUPERADMIN, 'people?limit=3&offset=2');
    expect(page.people).toEqual(people.slice(2, 5));
    expect(page.total).toBe(people.length);
    for (const bad of ['people?state=gone', 'people?limit=101']) expect((await ask(SUPERADMIN, bad)).status, bad).toBe(400);
  });
});

describe('GET /api/console/platform/usage', () => {
  const TILE = ['last', 'previous', 'weeks'];

  it('answers the superadmin every part in the declared shape', async () => {
    const ava = await read(SUPERADMIN, 'platform/usage');
    expect(keys(ava)).toEqual(['callsByWeek', 'followup', 'meta', 'modelCalls', 'mostUsed', 'perApproval', 'refusals', 'rhythm', 'tiles', 'tools', 'traffic']);
    expect(keys(ava.meta)).toEqual(META);
    const tiles = ok(ava.tiles);
    expect(keys(tiles)).toEqual(['calls', 'p95Ms', 'refusedShare', 'sessions']);
    for (const t of Object.values(tiles) as Json[]) { expect(keys(t)).toEqual(TILE); for (const w of [...t.weeks, t.last, t.previous]) isPeriod(w); }
    for (const w of ok(ava.callsByWeek).weeks) { expect(keys(w)).toEqual(['calls', 'parts', 'window']); expect(keys(w.calls)).toEqual(FIGURE); }
    expect(keys(ok(ava.traffic))).toEqual(['maintenance', 'window', 'work']);
    expect(keys(ok(ava.refusals))).toEqual(['guardrail', 'maintenance', 'other', 'ours', 'theirs', 'window']);
    for (const w of ok(ava.followup).weeks) {
      expect(keys(w)).toEqual(['medianSeconds', 'putRight', 'sessionsContinued', 'unassessable', 'window']);
      isPeriod(w.putRight);
      isPeriod(w.sessionsContinued);
      expect(keys(w.medianSeconds)).toEqual(FIGURE);
    }
    const tools = ok(ava.tools);
    expect(keys(tools)).toEqual(['rows', 'total']);
    for (const r of tools.rows) {
      expect(keys(r)).toEqual(['first', 'last', 'tool']);
      for (const side of [r.first, r.last]) { expect(keys(side)).toEqual(['calls', 'medianMs', 'window']); expect(keys(side.medianMs)).toEqual(FIGURE); }
    }
    const rhythm = ok(ava.rhythm);
    expect(keys(rhythm)).toEqual(['timezone', 'values', 'window']);
    expect(rhythm.timezone).toBe(ava.meta.timezone);
    expect(rhythm.values).toHaveLength(7);
    for (const day of rhythm.values) expect(day).toHaveLength(24);
    expect(keys(ok(ava.mostUsed))).toEqual(['rows', 'total']);
    expect(keys(ok(ava.perApproval))).toEqual(['last', 'previous']);
    const model = ok(ava.modelCalls);
    expect(keys(model)).toEqual(['byPurpose', 'cost', 'last', 'previous']);
    for (const w of [model.last, model.previous]) expect(keys(w)).toEqual(['calls', 'failed', 'inputTokens', 'outputTokens', 'window']);
    expect(model.cost).toBe('not_recorded');
  });

  it('splits the superadmin\'s weeks into three named teams and Other, and reads the states the page draws', async () => {
    const ava = await read(SUPERADMIN, 'platform/usage');
    const weeks = ok(ava.callsByWeek).weeks;
    const slugs = (await read(SUPERADMIN, 'teams')).teams.map((t: Json) => t.slug);
    for (const w of weeks) {
      expect(w.parts).toHaveLength(4);
      expect(w.parts.slice(0, 3).every((p: Json) => slugs.includes(p.label))).toBe(true);
      expect(w.parts[3].label).toBe('Other');
      expect(w.parts.reduce((n: number, p: Json) => n + p.calls, 0)).toBe(w.calls.value);
    }
    // More than four teams called, so Other holds calls in some week.
    expect(weeks.some((w: Json) => w.parts[3].calls > 0)).toBe(true);
    expect(weeks.at(-1).window.complete).toBe(false);
    expect(weeks.some((w: Json) => w.calls.value === 0)).toBe(true);
    expect(ok(ava.mostUsed).rows.map((r: Json) => r.tool)).toContain('Unregistered tools');
    // The calls a part counts: real work, and maintenance only where the part names it.
    expect(ok(ava.traffic).work).toBe(ok(ava.tiles).calls.last.figure.value);
    expect(ok(ava.followup).weeks.some((w: Json) => w.unassessable > 0)).toBe(true);
  });

  it('answers a member the same figures with no split by team and no team named', async () => {
    const ava = await read(SUPERADMIN, 'platform/usage');
    const noah = await read(MEMBER, 'platform/usage');
    expect(noah.meta.scope).toBe('platform-public');
    for (const w of ok(noah.callsByWeek).weeks) expect(w.parts).toBeNull();
    const strip = (u: Json) => ({ ...u, meta: null, callsByWeek: ok(u.callsByWeek).weeks.map((w: Json) => ({ ...w, parts: null })) });
    expect(strip(noah)).toEqual(strip(ava));
    const slugs = (await read(SUPERADMIN, 'teams')).teams.map((t: Json) => t.slug);
    const text = JSON.stringify(noah);
    for (const s of slugs) expect(new RegExp(`\\b${s}\\b`).test(text), s).toBe(false);
  });
});

describe('GET /api/console/platform/knowledge', () => {
  it('answers the superadmin every part in the declared shape, every shelf named and the questions', async () => {
    const ava = await read(SUPERADMIN, 'platform/knowledge');
    expect(keys(ava)).toEqual(['byKind', 'cohorts', 'made', 'meta', 'questions', 'searches', 'shelves', 'tiles']);
    expect(keys(ava.meta)).toEqual(META);
    const tiles = ok(ava.tiles);
    expect(keys(tiles)).toEqual(['madeLastWeek', 'noResult', 'searches', 'standing']);
    for (const k of ['madeLastWeek', 'noResult', 'searches']) { expect(keys(tiles[k])).toEqual(['last', 'previous']); isPeriod(tiles[k].last); isPeriod(tiles[k].previous); }
    const shelves = ok(ava.shelves).rows;
    for (const s of shelves) {
      expect(keys(s)).toEqual(['imported', 'kind', 'madeLastWeek', 'noResult', 'searchesLastWeek', 'shelf', 'standing', 'superseded']);
      isPeriod(s.noResult);
    }
    expect(shelves.map((s: Json) => s.kind).sort()).toEqual(['all', 'own', 'shared', 'team', 'team']);
    expect(shelves.find((s: Json) => s.shelf === 'all').standing).toBe(tiles.standing);
    const made = ok(ava.made);
    expect(keys(made)).toEqual(['exactFrom', 'weeks']);
    for (const w of made.weeks) { expect(keys(w)).toEqual(['importedByDay', 'importedExact', 'made', 'window']); expect(keys(w.made)).toEqual(FIGURE); }
    for (const w of ok(ava.searches).weeks) {
      expect(keys(w)).toEqual(['meanResults', 'noResult', 'widened', 'window']);
      isPeriod(w.noResult);
      isPeriod(w.widened);
    }
    for (const r of ok(ava.cohorts).rows) expect(keys(r)).toEqual(['basis', 'imported', 'made', 'supersededSince', 'window']);
    for (const r of ok(ava.byKind)) expect(keys(r)).toEqual(['kind', 'standing']);
    const questions = ok(ava.questions);
    expect(keys(questions)).toEqual(['rows', 'total', 'window']);
    expect(questions.window.complete).toBe(false);
    for (const q of questions.rows) expect(keys(q)).toEqual(['asked', 'lastAskedAt', 'question', 'shelf']);
    expect(questions.rows.map((q: Json) => q.asked)).toEqual([...questions.rows.map((q: Json) => q.asked)].sort((a, b) => b - a));
  });

  it('labels the imports, by day before lessons named themselves and exactly after, and counts them in no week of lessons made', async () => {
    const ava = await read(SUPERADMIN, 'platform/knowledge');
    const cohorts = ok(ava.cohorts).rows;
    const byDay = cohorts.find((c: Json) => c.basis === 'by_day');
    const exact = cohorts.find((c: Json) => c.basis === 'exact');
    const { exactFrom, weeks } = ok(ava.made);
    expect(Date.parse(byDay.window.to)).toBeLessThanOrEqual(Date.parse(exactFrom));
    expect(Date.parse(exact.window.from)).toBeGreaterThanOrEqual(Date.parse(exactFrom) - 7 * 24 * 3_600_000);
    for (const c of cohorts) {
      const w = weeks.find((x: Json) => x.window.from === c.window.from);
      expect(c.made, c.window.from).toBe(w.made.value + w.importedExact + w.importedByDay);
      expect(c.imported).toBe(w.importedExact + w.importedByDay);
    }
    expect(cohorts.some((c: Json) => c.supersededSince > 0)).toBe(true);
    expect(ok(ava.byKind).map((k: Json) => k.kind).sort()).toEqual(['behavior', 'decision', 'design', 'knowledge', 'process', 'style']);
    // A week with no searches has no share, never a zero.
    expect(ok(ava.searches).weeks.some((w: Json) => w.noResult.denominator === 0 && w.noResult.figure.why === 'no_data')).toBe(true);
  });

  it('answers a member their own shelf, the shared shelf and the totals, and no question or other shelf', async () => {
    const ava = await read(SUPERADMIN, 'platform/knowledge');
    const noah = await read(MEMBER, 'platform/knowledge');
    expect(noah.questions).toBeNull();
    const shelves = ok(noah.shelves).rows;
    expect(shelves.map((s: Json) => [s.shelf, s.kind])).toEqual([['own', 'own'], ['shared', 'shared'], ['all', 'all']]);
    const theirs = ok(ava.shelves).rows;
    const same = (a: Json, b: Json) => expect({ ...a, shelf: null, kind: null }).toEqual({ ...b, shelf: null, kind: null });
    same(shelves[0], theirs.find((s: Json) => s.kind === 'own'));
    same(shelves[1], theirs.find((s: Json) => s.kind === 'shared'));
    same(shelves[2], theirs.find((s: Json) => s.kind === 'all'));
    const strip = (k: Json) => ({ ...k, meta: null, shelves: null, questions: null });
    expect(strip(noah)).toEqual(strip(ava));
    const text = JSON.stringify(noah);
    for (const q of ok(ava.questions).rows) expect(text).not.toContain(q.question);
    for (const s of theirs.filter((x: Json) => x.kind !== 'all')) expect(new RegExp(`\\b${s.shelf}\\b`).test(text), s.shelf).toBe(false);
  });
});

describe('GET /api/console/platform/audit, the superadmin\'s', () => {
  /** Text the fixture plants in a label, a title, a file's name, a document's details, a refusal and a search's question. */
  const PLANTED = ['release scripts on the build box', 'salary', 'Salary', 'Chargeback ledger', 'payroll', 'beacon-salaries', 'laptop — release scripts'];

  it('answers administration as sentences in the declared shape, by default', async () => {
    const ava = await read(SUPERADMIN, 'platform/audit');
    expect(keys(ava)).toEqual(['ceiling', 'filter', 'meta', 'notRecorded', 'rows', 'total']);
    expect(keys(ava.meta)).toEqual(META);
    expect(ava).toMatchObject({ filter: 'administration', ceiling: 500 });
    expect(ava.notRecorded.length).toBeGreaterThan(0);
    const all = await read(SUPERADMIN, 'platform/audit?filter=administration&limit=100');
    expect(all.rows.slice(0, 10)).toEqual(ava.rows);
    for (const r of all.rows) {
      expect(keys(r)).toEqual(AUDIT_ROW);
      expect(r.sentence, r.kind).toEqual(expect.any(String));
      expect(r.kind).not.toBe('admin.list_oauth_clients');
    }
    // An act nobody recorded the actor of, one made in the console, and one made by maintenance.
    const nobody = all.rows.find((r: Json) => r.actor === null);
    expect(nobody.sentence.startsWith('Someone not recorded ')).toBe(true);
    const there = all.rows.find((r: Json) => r.inConsole);
    expect(there.sentence.endsWith(' in the console')).toBe(true);
    expect(all.rows.some((r: Json) => r.origin === 'platform')).toBe(true);
    // No sentence names a channel but the console.
    for (const r of all.rows) if (!r.inConsole) expect(r.sentence).not.toMatch(/in the console|mcp-oauth|\bvia\b/);
  });

  it('answers every event but page views under all, with subjects only where they cannot be free text', async () => {
    const admin = await read(SUPERADMIN, 'platform/audit?limit=100');
    const all = await read(SUPERADMIN, 'platform/audit?filter=all&limit=100');
    expect(all.filter).toBe('all');
    expect(all.total).toBeGreaterThan(admin.total);
    expect(all.rows.map((r: Json) => r.kind)).not.toContain('console.page_view');
    for (const r of all.rows.filter((x: Json) => x.sentence === null)) expect(r.kind.startsWith('admin.') && r.kind !== 'admin.list_oauth_clients').toBe(false);
    const search = all.rows.find((r: Json) => r.kind === 'knowledge.search');
    expect(search.subject).toBeNull();
    expect(all.rows.find((r: Json) => r.kind === 'tool_call' && r.ok === false).refusalOwner).toBe('guardrail');
    expect(all.rows.find((r: Json) => r.kind === 'pat.self_issue').subject).toBeNull();
    const text = JSON.stringify(all);
    for (const p of PLANTED) expect(text, p).not.toContain(p);
  });

  it('filters by kind, team and time before the ceiling, and pages', async () => {
    const all = (await read(SUPERADMIN, 'platform/audit?filter=all&limit=100')).rows;
    const switched = await read(SUPERADMIN, 'platform/audit?kind=team.switch');
    expect(switched.rows.map((r: Json) => r.kind)).toEqual(['team.switch']);
    const beacon = await read(SUPERADMIN, 'platform/audit?filter=all&team=beacon&limit=100');
    expect(beacon.rows.map((r: Json) => r.id)).toEqual(all.filter((r: Json) => r.team === 'beacon').map((r: Json) => r.id));
    const older = await read(SUPERADMIN, `platform/audit?filter=all&before=${encodeURIComponent(all[3].at)}&limit=100`);
    expect(older.rows.map((r: Json) => r.id)).toEqual(all.filter((r: Json) => Date.parse(r.at) < Date.parse(all[3].at)).map((r: Json) => r.id));
    const page = await read(SUPERADMIN, 'platform/audit?filter=all&limit=3&offset=2');
    expect(page.rows).toEqual(all.slice(2, 5));
    expect(page.total).toBe(all.length);
    for (const bad of ['platform/audit?filter=everything', 'platform/audit?before=yesterday', 'platform/audit?limit=101']) {
      expect((await ask(SUPERADMIN, bad)).status, bad).toBe(400);
    }
  });

  it('answers a path below a Fleet read 404, and a page past its bounds 400', async () => {
    for (const path of ['platform/usage/extra', 'platform/knowledge/extra', 'platform/audit/extra']) {
      for (const who of [null, MEMBER]) expect((await ask(who, path)).status, `GET ${path}`).toBe(404);
    }
    for (const bad of ['platform/audit?limit=0', 'platform/audit?offset=-1']) expect((await ask(SUPERADMIN, bad)).status, bad).toBe(400);
  });

  it('refuses a member before anything is read, with a body that names nobody', async () => {
    for (const path of ['platform/audit', 'platform/audit?filter=all', 'platform/audit?filter=everything&limit=0']) {
      const res = await ask(MEMBER, path);
      expect(res.status, path).toBe(403);
      expect(await res.json()).toEqual({ error: 'not permitted' });
    }
  });
});
