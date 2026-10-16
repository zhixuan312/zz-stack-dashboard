// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nav } from '../src/app.config.ts';
import { FEATURES } from '../src/data/features.ts';
import config from '../scripts/verify.config.ts';

/**
 * Work's remaining destinations as the fake gateway answers them: Knowledge, Activity, Runs and Plugins to both people,
 * each for the caller's active team, and Access for the caller alone, with its two revokes; a member in two teams who
 * switches and is answered the other team's afterwards; and the shared shelf's lesson, open to a member as shared.
 *
 * The key sets are written out from the shapes the gateway's tasks declare and never read from the fixture, so a field
 * the fake adds or drops fails here before the platform's own checks compare it with the real routes. Each case the
 * fixtures exist to draw is asserted by name, so a fixture that loses one fails here rather than on a page.
 */
type Json = Record<string, any>;

const personas = config.personas!;
const SUPERADMIN = personas.superadmin.cookie.value;
const MEMBER = personas.member.cookie.value;
const AVA = 'ava.lindqvist@example.com';
const NOAH = 'noah.okafor@example.com';

let server: ChildProcess;
let base = '';

beforeAll(async () => {
  const gateway = await startFakeGateway();
  server = gateway.proc;
  base = gateway.base;
});
afterAll(() => { server?.kill(); });

const ask = (who: string, path: string, method = 'GET') => fetch(`${base}/api/console/${path}`, { method, headers: { cookie: `zz_console=${who}` } });
const read = async (who: string, path: string): Promise<Json> => {
  const res = await ask(who, path);
  expect(res.status, `${who} GET ${path}`).toBe(200);
  return res.json();
};
const keys = (o: object) => Object.keys(o).sort();
const ok = (part: Json) => { expect(part.state).toBe('ok'); return part.data; };

const META = ['asOf', 'coverageFrom', 'period', 'population', 'scope', 'timezone'];
const FIGURE = ['value', 'why'];
const WINDOW = ['complete', 'from', 'observedFrom', 'observedThrough', 'to'];
const PERIOD = ['denominator', 'figure', 'numerator', 'window'];
const OWNERS = ['guardrail', 'other', 'ours', 'theirs'];
const BOTH = [['the superadmin', SUPERADMIN], ['the member', MEMBER]] as const;
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

describe('the feature Access declares', () => {
  it('declares Access on work:read, with no rail entry yet', () => {
    expect(FEATURES.access).toEqual({ title: 'Access', needs: 'work:read' });
    expect(nav.flatMap((g) => g.items.map((i) => i.href))).not.toContain('/access');
  });
});

describe('Knowledge', () => {
  const KNOWLEDGE_ROW = ['bytes', 'evidence', 'excerpt', 'key', 'num', 'path', 'status', 'superseded_by', 'tags', 'team', 'title', 'type', 'updated'];

  it.each(BOTH)('answers %s the active team\'s summary in the gateway\'s shape', async (_, who) => {
    const k = await read(who, 'knowledge/summary');
    expect(keys(k)).toEqual(['meta', 'newest', 'questions', 'tiles', 'weeks']);
    expect(keys(k.meta)).toEqual(META);
    expect(k.meta.scope).toBe('active-team');
    expect(keys(k.tiles)).toEqual(['noResult', 'searches', 'standing', 'superseded']);
    expect(keys(k.tiles.standing)).toEqual(['imported', ...FIGURE]);
    expect(keys(k.tiles.superseded)).toEqual(FIGURE);
    for (const t of [k.tiles.searches, k.tiles.noResult]) { expect(keys(t)).toEqual(PERIOD); expect(keys(t.window)).toEqual(WINDOW); }
    const questions = ok(k.questions);
    expect(keys(questions)).toEqual(['rows', 'total']);
    for (const q of questions.rows) expect(keys(q)).toEqual(['asked', 'lastAsked', 'question']);
    for (const w of ok(k.weeks)) expect(keys(w)).toEqual(PERIOD);
    for (const n of ok(k.newest)) expect(keys(n)).toEqual(['createdAt', 'imported', 'kind', 'path', 'team', 'title']);
  });

  it('counts the shelf as of the cutoff and the team\'s own questions that found nothing, most asked first', async () => {
    const k = await read(MEMBER, 'knowledge/summary');
    // A superseded lesson, and two imported among the standing ones.
    expect(k.tiles.superseded.value).toBeGreaterThan(0);
    expect(k.tiles.standing.imported).toBeGreaterThan(0);
    expect(k.tiles.noResult.denominator).toBe(k.tiles.searches.figure.value);
    const questions = ok(k.questions);
    // One question asked three times, written once in other capitals and spacing, and others asked once; ten answered of more.
    expect(questions.rows[0]).toMatchObject({ question: 'how do we rotate the signing key', asked: 3 });
    expect(questions.rows.some((q: Json) => q.question === 'where is the ranking eval' && q.asked === 1)).toBe(true);
    expect(questions.rows).toHaveLength(10);
    expect(questions.total).toBeGreaterThan(10);
    // Another team's question is never among them.
    expect(JSON.stringify(k)).not.toContain('chargeback');
    const weeks = ok(k.weeks);
    expect(weeks.at(-1).window.complete).toBe(false);
    for (const w of weeks.filter((x: Json) => x.denominator)) expect(w.figure.value).toBeCloseTo((100 * w.numerator) / w.denominator);
    expect(ok(k.newest)).toHaveLength(5);
    expect(ok(k.newest).every((n: Json) => n.team === 'atlas')).toBe(true);
  });

  it.each(BOTH)('answers %s the team\'s shelf paged and filtered on the server, with its summary', async (_, who) => {
    const l = await read(who, 'knowledge');
    expect(keys(l)).toEqual(['meta', 'rows', 'summary', 'total']);
    expect(keys(l.summary)).toEqual(['byKind', 'standing', 'superseded']);
    expect(l.total).toBeGreaterThan(10);
    expect(l.rows).toHaveLength(10);
    for (const r of l.rows) { expect(keys(r)).toEqual(KNOWLEDGE_ROW); expect(r.team).toBe('atlas'); }
    expect(sum(l.summary.byKind)).toBe(l.total);
    expect(l.summary.standing + l.summary.superseded).toBe(l.total);
    const rest = await read(who, 'knowledge?offset=10');
    expect(rest.rows).toHaveLength(l.total - 10);
    expect(rest.summary).toEqual(l.summary);
    const decisions = await read(who, 'knowledge?kind=decision&limit=100');
    expect(decisions.rows.every((r: Json) => r.type === 'decision')).toBe(true);
    expect(decisions.total).toBe(l.summary.byKind.decision);
    const q = await read(who, 'knowledge?q=RECENCY');
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows.every((r: Json) => /recency/i.test(`${r.title} ${r.excerpt} ${(r.tags ?? []).join(' ')}`))).toBe(true);
    // Nor the shared shelf, which the search reads and the list never answers.
    expect(JSON.stringify(await read(who, 'knowledge?limit=100&scope=platform&team=beacon'))).not.toMatch(/zz-platform|beacon/);
  });

  // The store's own check allows these six kinds, and the shelf's filter offers exactly them: a lesson of any other
  // kind would be drawn in the table under a kind no filter can select, so the row would be served and unreachable.
  const STORE_KINDS = ['decision', 'design', 'process', 'knowledge', 'behavior', 'style'];

  it.each(BOTH)('serves %s only kinds the shelf can be narrowed to', async (_, who) => {
    const l = await read(who, 'knowledge?limit=100');
    expect(l.rows.length).toBeGreaterThan(0);
    for (const r of l.rows) expect(STORE_KINDS, `${r.team}/${r.path} is a ${r.type}`).toContain(r.type);
    for (const kind of keys(l.summary.byKind)) expect(STORE_KINDS, kind).toContain(kind);
  });

  it('refuses a kind, a limit or an offset the route does not take', async () => {
    for (const path of ['knowledge?kind=pattern', 'knowledge?limit=101', 'knowledge?offset=-1', 'knowledge?limit=0']) expect((await ask(MEMBER, path)).status, path).toBe(400);
  });

  it('opens every lesson the list names', async () => {
    const { rows } = await read(MEMBER, 'knowledge?limit=100');
    for (const r of rows) expect((await ask(MEMBER, `knowledge/${r.team}/${r.path}`)).status, r.path).toBe(200);
  });

  it('searches the platform\'s shared shelf beside the team\'s own', async () => {
    const found = await read(MEMBER, 'search?q=recency');
    expect(found.results.some((r: Json) => r.shelf === 'team' && r.team === 'atlas')).toBe(true);
    expect(found.results.some((r: Json) => r.shelf === 'platform' && r.team === 'zz-platform' && r.kind === 'node')).toBe(true);
  });
});

describe('Activity', () => {
  const WEEK = ['calls', 'complete', 'owners', 'refused', 'window'];
  const GROUP = ['count', 'lastSeen', 'message', 'owner', 'tool'];
  const EVENT = ['actor', 'id', 'initiative', 'kind', 'message', 'ok', 'owner', 'step', 'tool', 'ts'];

  it.each(BOTH)('answers %s the active team\'s summary in the gateway\'s shape', async (_, who) => {
    const a = await read(who, 'activity/summary');
    expect(keys(a)).toEqual(['groups', 'maintenance', 'meta', 'tiles', 'weeks']);
    expect(keys(a.meta)).toEqual(META);
    expect(keys(a.tiles)).toEqual(['calls', 'mostRefused', 'refused']);
    expect(keys(a.tiles.calls)).toEqual(PERIOD);
    expect(keys(a.tiles.refused)).toEqual(['owners', ...PERIOD].sort());
    expect(keys(a.tiles.refused.owners)).toEqual(OWNERS);
    expect(keys(a.tiles.mostRefused)).toEqual(['count', 'of', 'tool']);
    for (const w of ok(a.weeks)) { expect(keys(w)).toEqual(WEEK); expect(keys(w.owners)).toEqual(OWNERS); }
    const groups = ok(a.groups);
    expect(keys(groups)).toEqual(['groups', 'rest', 'rows']);
    for (const g of groups.rows) expect(keys(g)).toEqual(GROUP);
    expect(keys(a.maintenance)).toEqual(['calls', 'refused']);
  });

  it('counts every refusal once under one owner, the four summing to the total each week', async () => {
    const a = await read(MEMBER, 'activity/summary');
    const weeks = ok(a.weeks);
    for (const w of weeks) expect(sum(w.owners), w.window.from).toBe(w.refused);
    // The last whole week: all four owners, and the tiles are that week.
    const last = weeks.at(-2);
    expect(Object.values(last.owners).every((n) => (n as number) > 0)).toBe(true);
    expect(a.tiles.refused.owners).toEqual(last.owners);
    expect(a.tiles.refused.figure.value).toBe(last.refused);
    expect(a.tiles.calls.figure.value).toBe(last.calls);
    expect(a.tiles.mostRefused.of).toBe(last.refused);
    // The week before it refused under `theirs` alone, which the chart keeps.
    expect(weeks.at(-3).owners).toEqual({ guardrail: 0, ours: 0, theirs: weeks.at(-3).refused, other: 0 });
    expect(weeks.at(-3).refused).toBeGreaterThan(0);
    // The maintenance the platform did is counted apart and changes nothing above.
    expect(a.maintenance.calls).toBeGreaterThan(0);
    expect(a.maintenance.refused).toBeGreaterThan(0);
  });

  it('groups the team\'s own messages by owner, tool and normalised text, and keeps a refusal with no text', async () => {
    const a = await read(MEMBER, 'activity/summary');
    const groups = ok(a.groups);
    // `section 4` and `section 7` are one group, answered as its most recent text.
    const sections = groups.rows.filter((g: Json) => /^ERROR: section \d of plan\.md/.test(g.message ?? ''));
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ owner: 'ours', count: 2 });
    expect(groups.rows.some((g: Json) => g.owner === 'other' && g.message === null)).toBe(true);
    const weeks = ok(a.weeks);
    expect(groups.rows.reduce((n: number, g: Json) => n + g.count, 0)).toBe(weeks.reduce((n: number, w: Json) => n + w.refused, 0));
    // Another team's sentences, and the maintenance's, are in no answer of atlas's.
    for (const path of ['activity/summary', 'activity?limit=100', 'activity/summary?scope=platform&team=beacon']) {
      expect(JSON.stringify(await read(SUPERADMIN, path)), path).not.toMatch(/beacon|chargeback|reindex/);
    }
  });

  it.each(BOTH)('answers %s the team\'s real-work log newest first, filtered before it is paged', async (_, who) => {
    const l = await read(who, 'activity');
    expect(keys(l)).toEqual(['ceiling', 'kinds', 'meta', 'rows', 'tools', 'total']);
    expect(l.ceiling).toBe(500);
    expect(l.total).toBeGreaterThan(10);
    expect(l.rows).toHaveLength(10);
    for (const r of l.rows) expect(keys(r)).toEqual(EVENT);
    const all = await read(who, 'activity?limit=100&offset=0');
    const ts = all.rows.map((r: Json) => r.ts);
    expect(ts).toEqual([...ts].sort().reverse());
    expect(all.rows.some((r: Json) => r.kind === 'console.page_view')).toBe(false);
    expect(l.kinds).not.toContain('console.page_view');
    const refused = await read(who, 'activity?refused=true&limit=100');
    expect(refused.rows.every((r: Json) => r.ok === false && r.owner !== null)).toBe(true);
    const owners = ok((await read(who, 'activity/summary')).weeks).reduce((n: number, w: Json) => n + w.refused, 0);
    expect(refused.total).toBe(owners);
    const tool = await read(who, `activity?tool=${encodeURIComponent(l.tools[0])}&refused=true&limit=100`);
    expect(tool.rows.every((r: Json) => r.tool === l.tools[0] && r.ok === false)).toBe(true);
    const kind = await read(who, 'activity?kind=skill_read&limit=100');
    expect(kind.total).toBeGreaterThan(0);
    expect(kind.rows.every((r: Json) => r.kind === 'skill_read')).toBe(true);
    const initiative = await read(who, 'activity?initiative=2026-09-28-search-relevance&limit=100');
    expect(initiative.total).toBeGreaterThan(0);
    expect(initiative.rows.every((r: Json) => r.initiative === '2026-09-28-search-relevance')).toBe(true);
    // Another team's slug names nothing of this team's, and is answered no rows rather than refused.
    expect((await read(who, 'activity?initiative=2026-09-30-refund-flow')).total).toBe(0);
  });

  it('refuses a limit, an offset or a refused it does not take', async () => {
    for (const path of ['activity?limit=101', 'activity?offset=-1', 'activity?refused=yes', 'activity?refused=1']) expect((await ask(MEMBER, path)).status, path).toBe(400);
  });
});

describe('Runs', () => {
  const RUN = ['bytes', 'calls', 'id', 'initiative', 'lastCallAt', 'lengthMs', 'refusals', 'skill', 'startedAt', 'state'];
  const SKILL = ['callsPerRun', 'outputPerRun', 'runs', 'shareRefused', 'skill', 'timed', 'typicalMs'];

  it.each(BOTH)('answers %s the active team\'s runs in the gateway\'s shape', async (_, who) => {
    const r = await read(who, 'runs');
    expect(keys(r)).toEqual(['bySkill', 'coverage', 'meta', 'recent', 'since', 'tiles']);
    expect(keys(r.meta)).toEqual(META);
    expect(keys(r.tiles)).toEqual(['largest', 'outputPerRun', 'runs']);
    expect(keys(r.tiles.runs)).toEqual(FIGURE);
    expect(keys(r.tiles.outputPerRun)).toEqual(['unmeasured', ...FIGURE]);
    expect(keys(r.tiles.largest)).toEqual(RUN);
    expect(keys(r.coverage)).toEqual(['coverageMs', 'oneCall', 'peak', 'summedMs']);
    for (const s of ok(r.bySkill).rows) expect(keys(s)).toEqual(SKILL);
    const recent = ok(r.recent);
    expect(keys(recent)).toEqual(['rows', 'total']);
    expect(recent.total).toBeGreaterThan(10);
    expect(recent.rows).toHaveLength(10);
    for (const row of recent.rows) expect(keys(row)).toEqual(RUN);
  });

  it('says how each run stands, and counts overlapping time once', async () => {
    const r = await read(MEMBER, 'runs?limit=100');
    const rows = ok(r.recent).rows;
    expect(rows.filter((x: Json) => x.state === 'active')).toHaveLength(1);
    expect(rows.some((x: Json) => x.state === 'one_call' && x.calls === 1 && x.lengthMs === 0)).toBe(true);
    expect(rows.some((x: Json) => x.bytes === null)).toBe(true);
    expect(r.tiles.outputPerRun.unmeasured).toBe(rows.filter((x: Json) => x.bytes === null).length);
    const ends = rows.map((x: Json) => x.lastCallAt);
    expect(ends).toEqual([...ends].sort().reverse());
    expect(r.coverage.coverageMs).toBeLessThan(r.coverage.summedMs);
    expect(r.coverage.peak).toBe(2);
    expect(r.coverage.oneCall).toBe(rows.filter((x: Json) => x.calls === 1).length);
    expect(r.tiles.runs.value).toBe(rows.length);
    expect(r.tiles.largest.bytes).toBe(Math.max(...rows.flatMap((x: Json) => (x.bytes === null ? [] : [x.bytes]))));
    // A skill no run of which was longer than one call has no typical length.
    expect(ok(r.bySkill).rows.some((s: Json) => s.timed === 0 && s.typicalMs === null)).toBe(true);
    // Beacon's larger run is none of atlas's.
    expect(rows.every((x: Json) => x.id.startsWith('run-atlas-'))).toBe(true);
  });

  it('narrows the tiles, the table and the recent runs to one skill', async () => {
    const r = await read(MEMBER, 'runs?skill=sdlc-plan');
    expect(ok(r.bySkill).rows.map((s: Json) => s.skill)).toEqual(['sdlc-plan']);
    expect(ok(r.recent).rows.every((x: Json) => x.skill === 'sdlc-plan')).toBe(true);
    expect(r.tiles.runs.value).toBe(ok(r.recent).total);
    expect((await read(MEMBER, 'runs?skill=no-such-skill')).tiles.runs.value).toBe(0);
    for (const path of ['runs?limit=101', 'runs?offset=-1']) expect((await ask(MEMBER, path)).status, path).toBe(400);
  });
});

describe('Plugins and skills', () => {
  const PLUGIN = ['agentName', 'comparability', 'description', 'documents', 'entry', 'flow', 'gates', 'install', 'owner', 'plugin', 'release', 'required', 'score', 'servers', 'skills', 'stages', 'version', 'yourTeam'];
  const SCORE = ['lower', 'protocol', 'scoredAt', 'standing', 'upper', 'value'];

  it.each(BOTH)('answers %s the catalog with its public scores and the team\'s own use', async (_, who) => {
    const { plugins } = await read(who, 'plugins');
    expect(plugins.length).toBeGreaterThan(3);
    for (const p of plugins) {
      expect(keys(p)).toEqual(PLUGIN);
      expect(keys(p.yourTeam)).toEqual(['calls', 'failed', 'lastRun']);
      expect(p.install).toBe(`claude plugin install ${p.plugin}@zz-stack`);
      if (p.score) { expect(keys(p.score)).toEqual(SCORE); expect(keys(p.score.protocol)).toEqual(['key', 'version']); }
      for (const s of p.skills) expect(keys(s)).toEqual(['calls', 'description', 'everRun', 'isEntry', 'lastRun', 'name', 'origin', 'position', 'source', 'version', 'versions']);
    }
    const by = (name: string) => plugins.find((p: Json) => p.plugin === name);
    expect(plugins.filter((p: Json) => p.required).map((p: Json) => p.plugin).sort()).toEqual(['zz-access', 'zz-core']);
    expect(by('sdlc').comparability).toMatch(/^Not comparable/);
    expect(by('zz-plugin-eval').comparability).toMatch(/^Comparable/);
    expect(by('research-kit').score).toBeNull();
    expect(by('research-kit').yourTeam).toEqual({ calls: 0, failed: 0, lastRun: null });
    expect(by('sdlc').yourTeam.calls).toBe(by('sdlc').skills.reduce((n: number, s: Json) => n + s.calls, 0));
  });

  it('gives the protocol\'s key to the superadmin alone', async () => {
    const key = async (who: string) => (await read(who, 'plugins')).plugins.find((p: Json) => p.plugin === 'sdlc').score.protocol.key;
    expect(await key(SUPERADMIN)).toBeTruthy();
    expect(await key(MEMBER)).toBeNull();
  });

  it('answers the team\'s skills, one plugin\'s with ?plugin, and one skill\'s detail', async () => {
    const all = (await read(MEMBER, 'skills')).skills;
    expect(all.length).toBeGreaterThan(3);
    const core = (await read(MEMBER, 'skills?plugin=zz-core')).skills;
    expect(core.map((s: Json) => s.name).sort()).toEqual(['zz-handover', 'zz-platform']);
    expect(core.find((s: Json) => s.name === 'zz-handover')).toMatchObject({ timedRuns: 0, durationMedian: null });
    expect((await read(MEMBER, 'skills?plugin=no-such-plugin')).skills).toEqual([]);
    expect(keys(await read(MEMBER, 'skills/sdlc-spec'))).toEqual(['busiestTools', 'skill', 'surfaces']);
    expect(await read(MEMBER, 'skills/no-such-skill')).toEqual({ skill: 'no-such-skill', surfaces: [], busiestTools: [] });
  });

  it('accepts no write under the plugins or the skills', async () => {
    for (const path of ['plugins', 'plugins/sdlc', 'skills']) expect((await ask(MEMBER, path, 'POST')).status, path).not.toBe(200);
  });
});

describe('Access', () => {
  const TOKEN = ['application', 'createdAt', 'id', 'label', 'lastUsedAt', 'revokedAt'];
  const APPLICATION = ['client', 'firstAt', 'issuedCount', 'lastUsedAt', 'name'];
  const BROWSER = ['current', 'expiresAt', 'id', 'issuedAt', 'lastSeenAt', 'userAgent'];
  const PASSKEY = ['createdAt', 'label', 'lastUsedAt', 'transports'];

  it.each(BOTH)('answers %s their own and nothing that could be used as a secret', async (_, who) => {
    const a = await read(who, 'access');
    expect(keys(a)).toEqual(['applications', 'authenticators', 'browsers', 'issued', 'meta', 'setup', 'teams']);
    expect(keys(a.meta)).toEqual(META);
    for (const t of a.issued) expect(keys(t)).toEqual(TOKEN);
    for (const p of a.applications) expect(keys(p)).toEqual(APPLICATION);
    for (const b of a.browsers) expect(keys(b)).toEqual(BROWSER);
    for (const k of a.authenticators) expect(keys(k)).toEqual(PASSKEY);
    expect(keys(a.teams)).toEqual(['actingFor', 'teams']);
    expect(keys(a.setup)).toEqual(['client', 'config']);
    expect(a.browsers.filter((b: Json) => b.current)).toHaveLength(1);
    expect(a.browsers.length).toBeGreaterThan(1);
    expect(a.authenticators.length).toBeGreaterThan(0);
    // No container is named after a token or a key, and nothing reads as a value or an address.
    expect(JSON.stringify(Object.keys(a))).not.toMatch(/token|key|secret|credential/i);
    expect(JSON.stringify(a)).not.toMatch(/zz_pat_|zzp_|redacted|\b\d{1,3}(\.\d{1,3}){3}\b/);
  });

  it('answers each person their own, never the other\'s', async () => {
    const ava = await read(SUPERADMIN, 'access');
    const noah = await read(MEMBER, 'access');
    expect(ava.setup.config).toContain(AVA);
    expect(noah.setup.config).toContain(NOAH);
    const ids = (a: Json) => [...a.issued, ...a.browsers].map((x: Json) => x.id);
    expect(ids(ava).filter((id) => ids(noah).includes(id))).toEqual([]);
    // An application authorised twice.
    expect(ava.applications.some((p: Json) => p.issuedCount === 2 && ava.issued.filter((t: Json) => t.application === p.client).length === 2)).toBe(true);
  });

  it('revokes the caller\'s own application and another browser, and refuses the rest as the platform does', async () => {
    const ava = await read(SUPERADMIN, 'access');
    const noah = await read(MEMBER, 'access');
    const app = ava.applications.find((p: Json) => p.issuedCount === 2);
    const revoke = await ask(SUPERADMIN, `settings/me/applications/${app.client}`, 'DELETE');
    expect([revoke.status, await revoke.json()]).toEqual([200, { ok: true, revoked: 2 }]);
    const other = ava.browsers.find((b: Json) => !b.current);
    const signOut = await ask(SUPERADMIN, `settings/me/browsers/${other.id}`, 'DELETE');
    expect([signOut.status, await signOut.json()]).toEqual([200, { ok: true, revoked: 1 }]);
    const current = await ask(SUPERADMIN, `settings/me/browsers/${ava.browsers.find((b: Json) => b.current).id}`, 'DELETE');
    expect(current.status).toBe(400);
    expect((await current.json()).error).toMatch(/sign out/);
    // Another person's application and browser are not found, rather than refused.
    expect((await ask(SUPERADMIN, `settings/me/applications/${noah.applications[0].client}`, 'DELETE')).status).toBe(404);
    expect((await ask(SUPERADMIN, `settings/me/browsers/${noah.browsers[1].id}`, 'DELETE')).status).toBe(404);
    expect((await ask(MEMBER, `settings/me/browsers/${other.id}`, 'DELETE')).status).toBe(404);
    // Forgotten, like every write: the next read is the same.
    expect(await read(SUPERADMIN, 'access')).toMatchObject({ applications: ava.applications, browsers: ava.browsers });
  });
});

describe('a member in two teams', () => {
  // A cookie of their own, so the switch below moves nobody another case reads as.
  const TWO = 'member-two-teams';
  const post = (who: string, body: unknown) => fetch(`${base}/api/console/settings/me/active-team`, {
    method: 'POST', headers: { cookie: `zz_console=${who}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const teamsOf = (rows: Json[]) => [...new Set(rows.map((r) => r.team))];

  it('posts /settings/me/active-team and is answered the other team\'s data afterwards', async () => {
    const me = await read(TWO, 'me');
    expect([me.email, me.role, me.activeTeam]).toEqual([NOAH, 'member', 'atlas']);
    expect(me.teams.map((t: Json) => t.slug)).toEqual(['atlas', 'beacon']);
    const before = { knowledge: (await read(TWO, 'knowledge?limit=100')).rows, initiatives: await read(TWO, 'initiatives?limit=100') };
    expect(teamsOf(before.knowledge)).toEqual(['atlas']);
    expect(before.initiatives.meta.population).toMatch(/^atlas's/);
    const atlasInitiative = before.initiatives.rows[0];
    expect((await ask(TWO, `initiatives/atlas/${atlasInitiative.slug}`)).status).toBe(200);

    // A team they are not in is refused as the gateway refuses it, and moves nothing.
    const refused = await post(TWO, { team: 'cinder' });
    expect([refused.status, await refused.json()]).toEqual([400, { error: 'not a member of cinder' }]);
    expect((await read(TWO, 'me')).activeTeam).toBe('atlas');

    const switched = await post(TWO, { team: 'beacon' });
    expect([switched.status, await switched.json()]).toEqual([200, { ok: true, actingFor: 'beacon', from: 'atlas' }]);

    expect((await read(TWO, 'me')).activeTeam).toBe('beacon');
    expect((await read(TWO, 'settings/me/teams')).actingFor).toBe('beacon');
    const after = { knowledge: (await read(TWO, 'knowledge?limit=100')).rows, initiatives: await read(TWO, 'initiatives?limit=100') };
    expect(teamsOf(after.knowledge)).toEqual(['beacon']);
    expect(after.initiatives.meta.population).toMatch(/^beacon's/);
    const slugs = (l: Json) => l.rows.map((r: Json) => r.slug);
    expect(slugs(after.initiatives).length).toBeGreaterThan(0);
    expect(slugs(after.initiatives).filter((x: string) => slugs(before.initiatives).includes(x))).toEqual([]);
    for (const path of ['knowledge/summary', 'activity/summary', 'activity', 'runs']) expect((await read(TWO, path)).meta.population, path).toMatch(/^beacon's/);
    // A deep link to the old team's initiative is a record that does not exist, as the gateway answers it.
    expect((await ask(TWO, `initiatives/atlas/${atlasInitiative.slug}`)).status).toBe(404);
    // The session is the cookie's: the member signed in with their own still reads their own team.
    expect((await read(MEMBER, 'me')).activeTeam).toBe('atlas');

    expect((await post(TWO, { team: 'atlas' })).status).toBe(200);
    expect((await read(TWO, 'me')).activeTeam).toBe('atlas');
  });

  it('refuses a slug that is not one, and keeps nothing for a request with no session cookie', async () => {
    expect((await post(TWO, { team: 'Not A Slug' })).status).toBe(400);
    const cookieless = await fetch(`${base}/api/console/settings/me/active-team`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ team: 'beacon' }) });
    expect([cookieless.status, await cookieless.json()]).toEqual([200, { ok: true, actingFor: 'beacon', from: 'atlas' }]);
    const ava = await fetch(`${base}/api/console/me`);
    expect((await ava.json()).activeTeam).toBe('atlas');
  });
});

describe('the shared shelf', () => {
  it('opens a lesson of the shared shelf to the member, marked shared, and another team\'s to nobody, the superadmin included', async () => {
    const shared = (await read(MEMBER, 'search?q=recency')).results.find((r: Json) => r.team === 'zz-platform' && r.kind === 'node');
    const lesson = await read(MEMBER, `knowledge/zz-platform/${shared.path}`);
    expect(lesson.shelf).toBe('shared');
    expect((await ask(MEMBER, 'knowledge/beacon/nodes/0001-refunds-are-a-ledger-entry-never-an-edit.md')).status).toBe(404);
    // Work is the active team's for the superadmin too: a scope the request names widens nothing.
    for (const scope of ['', '?scope=platform', '?team=beacon']) {
      expect((await ask(SUPERADMIN, `knowledge/beacon/nodes/0001-refunds-are-a-ledger-entry-never-an-edit.md${scope}`)).status, scope).toBe(404);
    }
  });
});
