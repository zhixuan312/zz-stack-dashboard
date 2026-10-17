// @vitest-environment node
import type { ChildProcess } from 'node:child_process';
import { startFakeGateway } from './fake-gateway-start.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nav } from '../src/app.config.ts';
import { FEATURES } from '../src/data/features.ts';
import config from '../scripts/verify.config.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';

/**
 * Work's reads and the close as the fake gateway answers them: Home, Record, Approvals, the paged Initiatives and the
 * prepared queries to both people, each for the caller's active team and the approvals in them the caller's own, and
 * a close answered as the platform decides one.
 *
 * The key sets are written out from the shapes the gateway's tasks declare and never read from the fixture, so a field
 * the fake adds or drops fails here before the platform's own checks compare it with the real routes.
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

const ask = (who: string, path: string) => fetch(`${base}/api/console/${path}`, { headers: { cookie: `zz_console=${who}` } });
const read = async (who: string, path: string): Promise<Json> => {
  const res = await ask(who, path);
  expect(res.status, `${who} GET ${path}`).toBe(200);
  return res.json();
};
const post = (who: string, path: string, body: unknown) =>
  fetch(`${base}/api/console/${path}`, { method: 'POST', headers: { cookie: `zz_console=${who}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const keys = (o: object) => Object.keys(o).sort();
const ok = (part: Json) => { expect(part.state).toBe('ok'); return part.data; };

const META = ['asOf', 'coverageFrom', 'period', 'population', 'scope', 'timezone'];
const FIGURE = ['value', 'why'];
const WINDOW = ['complete', 'from', 'observedFrom', 'observedThrough', 'to'];
const PERIOD = ['denominator', 'figure', 'numerator', 'window'];
const ROW = ['closed', 'flow', 'gates', 'lastTouched', 'nextMove', 'opened', 'slug', 'state'];
const NEXT_MOVE = ['action', 'document', 'stage', 'waitingOn', 'why'];
const COVERAGE = ['datedByLastWrite', 'documents', 'importMade', 'missingLegacy', 'mixed', 'revisions', 'undated', 'unrecorded'];
const ESTIMATE = ['assumedWordsPerHour', 'basis', 'coverage', 'hours', 'words'];
const EVIDENCE = ['approvedAt', 'contentRevision', 'decisionBasis', 'initiative', 'path', 'presentation', 'version'];
const BOTH = [['the superadmin', SUPERADMIN], ['the member', MEMBER]] as const;

describe('the features Work declares', () => {
  it('declares Record and Approvals on work:read, with no rail entry yet', () => {
    expect(FEATURES.record).toEqual({ title: 'Record', needs: 'work:read' });
    expect(FEATURES.approvals).toEqual({ title: 'Approvals', needs: 'work:read' });
    const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain('/record');
    expect(hrefs).not.toContain('/approvals');
  });
});

describe('the initiatives list', () => {
  it.each(BOTH)('answers %s the active team\'s list in the gateway\'s shape, ten to a page', async (_, who) => {
    const l = await read(who, 'initiatives');
    expect(keys(l)).toEqual(['closures', 'meta', 'nextMoveState', 'rows', 'summary', 'tiles', 'total']);
    expect(keys(l.meta)).toEqual(META);
    expect(l.meta.scope).toBe('active-team');
    expect(keys(l.tiles)).toEqual(['closed', 'open', 'waiting']);
    expect(keys(l.tiles.closed)).toEqual(['abandoned', 'accepted', 'delivered']);
    for (const w of ok(l.closures)) {
      expect(keys(w)).toEqual(['abandoned', 'accepted', 'delivered', 'window']);
      expect(keys(w.window)).toEqual(WINDOW);
      expect(keys(w.accepted)).toEqual(FIGURE);
    }
    const s = ok(l.summary);
    expect(keys(s)).toEqual(['byFlow', 'byState', 'previous', 'total', 'touched']);
    expect(keys(s.byState)).toEqual(['abandoned', 'accepted', 'delivered', 'open', 'quiet', 'waiting']);
    expect(keys(s.previous)).toEqual(['total', 'window']);
    for (const t of s.touched) expect(keys(t)).toEqual(PERIOD);
    expect(l.total).toBeGreaterThan(10);
    expect(l.rows).toHaveLength(10);
    expect(l.nextMoveState).toBe('ok');
    for (const r of l.rows) {
      expect(keys(r)).toEqual(ROW);
      expect(keys(r.nextMove)).toEqual(NEXT_MOVE);
      expect(keys(r.gates)).toEqual(['of', 'passed']);
    }
    const rest = await read(who, 'initiatives?offset=10');
    expect(rest.rows).toHaveLength(l.total - 10);
    // A page changes the rows, never the summary of the whole population.
    expect(rest.summary).toEqual(l.summary);
    expect(new Set([...l.rows, ...rest.rows].map((r: Json) => r.state))).toEqual(new Set(['open', 'waiting', 'quiet', 'accepted', 'delivered', 'abandoned']));
  });

  it('sorts waiting first, then the most recently touched', async () => {
    const { rows } = await read(SUPERADMIN, 'initiatives?limit=100');
    const waiting = rows.findIndex((r: Json) => r.state !== 'waiting');
    expect(rows.slice(waiting).every((r: Json) => r.state !== 'waiting')).toBe(true);
    const rest = rows.slice(waiting).map((r: Json) => r.lastTouched);
    expect(rest).toEqual([...rest].sort().reverse());
  });

  it('filters on the server before paging, with the total and the summary of what matched', async () => {
    const all = await read(MEMBER, 'initiatives');
    const quiet = await read(MEMBER, 'initiatives?state=quiet');
    expect(quiet.rows.length).toBeGreaterThan(0);
    expect(quiet.rows.every((r: Json) => r.state === 'quiet')).toBe(true);
    expect(quiet.total).toBe(ok(all.summary).byState.quiet);
    expect(ok(quiet.summary).total).toBe(quiet.total);
    // The tiles are the team's whatever the filters.
    expect(quiet.tiles).toEqual(all.tiles);
    const flow = await read(MEMBER, 'initiatives?flow=sdlc-flow&limit=100');
    expect(flow.rows.every((r: Json) => r.flow === 'sdlc-flow')).toBe(true);
    expect(flow.total).toBeLessThan(all.total);
    const q = await read(MEMBER, 'initiatives?q=relevance');
    expect(q.rows.map((r: Json) => r.slug)).toEqual(['2026-09-28-search-relevance']);
    expect((await ask(MEMBER, 'initiatives?state=stuck')).status).toBe(400);
    expect((await ask(MEMBER, 'initiatives?limit=101')).status).toBe(400);
  });

  it('answers the active team alone: no row names a team, and ?team= or ?scope= widen nothing', async () => {
    const own = await read(SUPERADMIN, 'initiatives?limit=100');
    for (const path of ['initiatives?limit=100&team=beacon', 'initiatives?limit=100&scope=platform']) {
      const asked = await read(SUPERADMIN, path);
      expect(asked.rows).toEqual(own.rows);
    }
    expect(JSON.stringify(own.rows)).not.toContain('"team"');
    expect(JSON.stringify(own)).not.toContain('refund-flow');
  });

  it('no longer answers the bell\'s old projection: ?waiting=1 is the list', async () => {
    expect(keys(await read(MEMBER, 'initiatives?waiting=1'))).not.toContain('waiting');
  });
});

describe('the close', () => {
  const at = (slug: string, team = 'atlas') => `initiatives/${team}/${slug}/close`;
  const READY = '2026-10-08-result-explanations';

  it('derives the outcome from the facts, as the platform does, and reads the closer from the session', async () => {
    for (const [body, outcome] of [
      [{ disposition: 'finished' }, 'accepted'],
      [{ disposition: 'finished', accepted_by: NOAH }, 'accepted'],
      [{ disposition: 'finished', no_signoff_reason: 'The stakeholder left before signing.' }, 'delivered'],
      [{ disposition: 'abandoned' }, 'abandoned'],
    ] as const) {
      const res = await post(MEMBER, at(READY), body);
      expect(res.status, JSON.stringify(body)).toBe(200);
      expect(await res.json()).toEqual({ outcome, closedBy: NOAH, document: 'review.md' });
    }
    expect(await (await post(SUPERADMIN, at(READY), { disposition: 'finished' })).json()).toEqual({ outcome: 'accepted', closedBy: AVA, document: 'review.md' });
  });

  it('closes freeform work on the document it names, and abandons work with the furthest one', async () => {
    const notes = '2026-09-05-research-notes';
    expect((await post(MEMBER, at(notes), { disposition: 'finished' })).status).toBe(400);
    expect(await (await post(MEMBER, at(notes), { disposition: 'finished', document: 'notes.md' })).json()).toEqual({ outcome: 'accepted', closedBy: NOAH, document: 'notes.md' });
    expect(await (await post(MEMBER, at('2026-10-06-snippet-quality'), { disposition: 'abandoned' })).json()).toEqual({ outcome: 'abandoned', closedBy: NOAH, document: 'explore.md' });
  });

  it('refuses what the route refuses, so a close no longer fake-succeeds', async () => {
    const cases: [string, unknown, number][] = [
      [at(READY, 'beacon'), { disposition: 'finished' }, 404],
      [at('2026-09-30-refund-flow', 'beacon'), { disposition: 'finished' }, 404],
      [at('no-such-initiative'), { disposition: 'finished' }, 404],
      [at(READY), { disposition: 'finished', outcome: 'accepted' }, 400],
      [at(READY), { disposition: 'finished', closed_by: AVA }, 400],
      [at(READY), { disposition: 'finished', accepted_by: NOAH, no_signoff_reason: 'both' }, 400],
      [at(READY), { disposition: 'done' }, 400],
      [at('2026-10-02-query-latency'), { disposition: 'finished' }, 400],
      [at('2026-08-14-citation-graph'), { disposition: 'abandoned' }, 409],
    ];
    for (const [path, body, status] of cases) {
      for (const [, who] of BOTH) expect((await post(who, path, body)).status, `${who} ${path} ${JSON.stringify(body)}`).toBe(status);
    }
  });
});

describe('Home', () => {
  it.each(BOTH)('answers %s the active team\'s week in the gateway\'s shape', async (_, who) => {
    const h = await read(who, 'home');
    expect(keys(h)).toEqual(['approvals', 'closedLastWeek', 'foot', 'meta', 'milestones', 'openWork', 'runs', 'tiles', 'title', 'waiting', 'words']);
    expect(keys(h.meta)).toEqual(META);
    expect(keys(h.title)).toEqual(['rule', 'sentence']);
    expect(keys(ok(h.waiting))).toEqual(['count', 'oldestSince', 'one']);
    const words = ok(h.words);
    expect(keys(words)).toEqual(['coverage', 'finding', 'weeks']);
    expect(keys(words.coverage)).toEqual(COVERAGE);
    expect(keys(words.finding)).toEqual(['dates', 'kind', 'text', 'tie']);
    for (const w of words.weeks) expect(keys(w)).toEqual(PERIOD);
    expect(keys(ok(h.approvals))).toEqual(['finding', 'weeks']);
    expect(keys(h.foot)).toEqual(['coverageMs', 'estimate', 'peak']);
    expect(keys(h.foot.estimate)).toEqual(ESTIMATE);
    expect(h.foot.estimate.basis).toBe('period_net_additions');
    expect(keys(h.tiles)).toEqual(['agentDays', 'closed', 'medianHoursToClose', 'searchesWithResults']);
    for (const t of Object.values(h.tiles)) expect(keys(t as object)).toEqual(PERIOD);
    const runs = ok(h.runs);
    expect(keys(runs)).toEqual(['active', 'lastRunAt', 'more']);
    for (const g of runs.active) for (const r of g.runs) expect(keys(r)).toEqual(['lastAt', 'skill', 'startedAt']);
    for (const m of ok(h.milestones)) expect(keys(m)).toEqual(['count', 'last', 'next', 'value']);
    const open = ok(h.openWork);
    expect(keys(open)).toEqual(['quiet', 'rows', 'total']);
    for (const r of open.rows) expect(keys(r)).toEqual(ROW);
    for (const c of ok(h.closedLastWeek)) expect(keys(c)).toEqual(['closedAt', 'outcome', 'slug']);
  });

  it('draws the states the page designs for', async () => {
    const h = await read(MEMBER, 'home');
    expect(h.title.rule).toBe(8);
    const weeks = ok(h.words).weeks;
    expect(weeks.at(-1).window.complete).toBe(false);
    expect(weeks.some((w: Json) => w.figure.value === null && w.figure.why === 'no_data')).toBe(true);
    const coverage = ok(h.words).coverage;
    expect(coverage.unrecorded + coverage.missingLegacy).toBeGreaterThan(0);
    expect(coverage.importMade).toBeGreaterThan(0);
    // More than four runs active: grouped by initiative, at most four groups, and the rest counted.
    const runs = ok(h.runs);
    expect(runs.active.length).toBe(4);
    expect(runs.more).toBeGreaterThan(0);
    expect(runs.active.some((g: Json) => g.runs.length > 1)).toBe(true);
    const open = ok(h.openWork);
    expect(open.quiet).toBeGreaterThan(0);
    expect(open.rows.length + 1).toBeLessThanOrEqual(5);
    expect(open.rows.every((r: Json) => r.state !== 'quiet' && r.nextMove)).toBe(true);
    expect(open.rows[0].state).toBe('waiting');
    expect(new Set(ok(h.closedLastWeek).map((c: Json) => c.outcome)).size).toBeGreaterThan(1);
    // What waits is the approvals queue's.
    expect(ok(h.waiting).count).toBe(ok((await read(MEMBER, 'approvals')).waiting).total);
  });

  it('counts the approvals each person signed, and names one waiting revision when there is one', async () => {
    const [ava, noah] = [await read(SUPERADMIN, 'home'), await read(MEMBER, 'home')];
    expect(ok(ava.approvals).weeks).not.toEqual(ok(noah.approvals).weeks);
    expect(ava.words).toEqual(noah.words);
    const first = homeOf('beacon', AVA);
    expect(first.title.rule).toBe(1);
    expect(ok(first.waiting as Json).one).toEqual({ initiative: '2026-09-30-refund-flow', path: 'spec.md', version: 1 });
  });
});

describe('Record', () => {
  it.each(BOTH)('answers %s the active team\'s record in the gateway\'s shape', async (_, who) => {
    const r = await read(who, 'record');
    expect(keys(r)).toEqual(['agents', 'cumulative', 'documents', 'firsts', 'foot', 'knowledge', 'lead', 'meta', 'period', 'record', 'work']);
    expect(r.period).toBe('all');
    expect(keys(r.lead)).toEqual(['asOf', 'estimate']);
    expect(keys(r.lead.estimate)).toEqual(ESTIMATE);
    expect(r.lead.estimate.basis).toBe('retained_stock');
    expect(keys(r.foot)).toEqual(['approvalsInYourName', 'closed', 'documents', 'opened', 'versions']);
    expect(keys(ok(r.work))).toEqual(['closedByOutcome', 'closuresByWeek', 'closuresInAll', 'medianHoursByWeek', 'medianHoursToAbandon', 'medianHoursToClose', 'mostOpenAtOnce', 'typical']);
    expect(keys(ok(r.work).typical)).toEqual(['documents', 'sources', 'versions', 'words']);
    expect(keys(ok(r.documents))).toEqual(['citations', 'coverage', 'flowDocuments', 'mostRewritten', 'sourcesUnderGated', 'versions', 'wordsByWeek']);
    expect(keys(ok(r.knowledge))).toEqual(['adopted', 'adoptedInAll', 'byKind', 'meanResults', 'ownReturned', 'returnedByKind', 'searchesWithResults', 'sharedResults']);
    const agents = ok(r.agents);
    expect(keys(agents)).toEqual(['bySkill', 'coverageMs', 'days', 'peak', 'runs', 'skillsUsed', 'summedMs', 'weekdayHour', 'zeroLength']);
    expect(agents.weekdayHour).toHaveLength(7);
    for (const d of agents.weekdayHour) expect(d).toHaveLength(24);
    const firsts = ok(r.firsts);
    expect(keys(firsts)).toEqual(['bests', 'firsts']);
    expect(firsts.bests.map((b: Json) => b.key).sort()).toEqual(['most_open', 'most_sources', 'most_versions', 'most_words_week']);
    expect(firsts.firsts.map((f: Json) => f.key).sort()).toEqual(['approved', 'closed', 'lesson', 'run', 'words_week']);
    const table = ok(r.record);
    expect(keys(table)).toEqual(['rows', 'summary', 'total']);
    expect(keys(table.summary.byOutcome)).toEqual(['abandoned', 'accepted', 'delivered', 'open']);
    for (const row of table.rows) expect(keys(row)).toEqual(['closed', 'documents', 'lessons', 'opened', 'outcome', 'slug', 'tookHours']);
    expect(table.rows).toHaveLength(10);
    expect(table.total).toBeGreaterThan(10);
  });

  it('keeps the retained text the same in every period, and answers months for a period longer than 26 weeks', async () => {
    const answers = await Promise.all(['quarter', 'year', 'all'].map((p) => read(MEMBER, `record?period=${p}`)));
    for (const a of answers) expect(a.lead).toEqual(answers[0].lead);
    const year = answers[1];
    const long = Date.parse(year.meta.asOf) - Date.parse(year.meta.period.from) > 26 * 7 * 24 * 3_600_000;
    expect(year.cumulative.every((p: Json) => p.window.from.slice(8, 10) === '01')).toBe(long);
    expect(Date.parse(answers[0].meta.period.from)).toBeGreaterThanOrEqual(Date.parse(year.meta.period.from));
    expect((await ask(MEMBER, 'record?period=month')).status).toBe(400);
    const second = ok((await read(MEMBER, 'record?offset=10')).record);
    expect(second.rows.length).toBe(ok(answers[2].record).total - 10);
  });

  it('counts the approvals in the caller\'s own name', async () => {
    const [ava, noah] = [await read(SUPERADMIN, 'record'), await read(MEMBER, 'record')];
    expect(ava.foot.approvalsInYourName.value).toBeGreaterThan(noah.foot.approvalsInYourName.value);
    expect(ava.lead).toEqual(noah.lead);
  });
});

describe('Approvals', () => {
  it.each(BOTH)('answers %s the team\'s queue and their own history in the gateway\'s shape', async (_, who) => {
    const a = await read(who, 'approvals');
    expect(keys(a)).toEqual(['history', 'meta', 'tiles', 'waiting', 'weeks']);
    expect(a.meta.scope).toBe('caller-in-active-team');
    expect(keys(a.tiles)).toEqual(['inYourName', 'noPresentation', 'oldestWaitingSince', 'waiting']);
    expect(keys(a.tiles.noPresentation)).toEqual(['count', 'of']);
    for (const w of a.weeks) expect(keys(w)).toEqual(PERIOD);
    const waiting = ok(a.waiting);
    expect(keys(waiting)).toEqual(['queue', 'rows', 'summary', 'total']);
    expect(waiting.queue).toBe('team');
    expect(keys(waiting.summary)).toEqual(['byInitiative', 'olderThan14Days']);
    for (const r of waiting.rows) expect(keys(r)).toEqual(['contentRevision', 'initiative', 'path', 'version', 'waitingSince']);
    const history = ok(a.history);
    expect(keys(history)).toEqual(['rows', 'summary', 'total']);
    expect(keys(history.summary)).toEqual(['byDecisionBasis', 'byInitiative', 'byPresentation']);
    expect(keys(history.summary.byPresentation)).toEqual(['agent_context_covered', 'console_revision_shown', 'not_recorded', 'unknown']);
    expect(keys(history.summary.byDecisionBasis)).toEqual(['explicit_recorded', 'standing_delegation_recorded', 'unknown']);
    for (const r of history.rows) expect(keys(r)).toEqual(EVIDENCE);
  });

  it('holds every evidence class, both decision bases, a wait past 14 days and a history that pages', async () => {
    const a = await read(SUPERADMIN, 'approvals?tab=history');
    const history = ok(a.history);
    for (const n of Object.values(history.summary.byPresentation)) expect(n).toBeGreaterThan(0);
    for (const n of Object.values(history.summary.byDecisionBasis)) expect(n).toBeGreaterThan(0);
    expect(history.rows.some((r: Json) => /^\d{4}-\d{2}-\d{2}$/.test(r.approvedAt))).toBe(false);
    expect(history.total).toBeGreaterThan(10);
    expect(history.rows).toHaveLength(10);
    const rest = ok((await read(SUPERADMIN, 'approvals?tab=history&offset=10')).history);
    expect(rest.rows.length).toBe(history.total - 10);
    expect(rest.rows.some((r: Json) => /^\d{4}-\d{2}-\d{2}$/.test(r.approvedAt))).toBe(true);
    expect(ok(a.waiting).summary.olderThan14Days).toBeGreaterThan(0);
    // The other tab answers its first page and its total.
    expect(ok(a.waiting).total).toBe(a.tiles.waiting);
    expect((await ask(SUPERADMIN, 'approvals?tab=all')).status).toBe(400);
  });

  it('answers each person only the approvals signed in their name, in their active team', async () => {
    const [ava, noah] = [await read(SUPERADMIN, 'approvals?tab=history&limit=100'), await read(MEMBER, 'approvals?tab=history&limit=100')];
    const revisions = (x: Json) => new Set(ok(x.history).rows.map((r: Json) => r.contentRevision));
    const both = [...revisions(ava)].filter((r) => revisions(noah).has(r));
    expect(both).toEqual([]);
    expect(ok(noah.history).total).toBeGreaterThan(0);
    expect(noah.tiles.inYourName).toBe(ok(noah.history).total);
    expect(JSON.stringify(ava)).not.toContain('payout-schedule');
    expect(ava.waiting).toEqual(noah.waiting);
  });
});

describe('the prepared queries', () => {
  const LAST_QUARTER = () => {
    const to = new Date();
    return `from=${new Date(to.getTime() - 91 * 24 * 3_600_000).toISOString()}&to=${to.toISOString()}`;
  };

  it.each(BOTH)('answers %s a grouped measure in the gateway\'s shape', async (_, who) => {
    const w = await read(who, `work/query?measure=closures&by=outcome&${LAST_QUARTER()}&compare=previous`);
    expect(keys(w)).toEqual(['by', 'grain', 'groups', 'measure', 'meta', 'rest', 'rows', 'total', 'window']);
    expect(keys(w.window)).toEqual(WINDOW);
    expect(w.grain).toBe(null);
    expect(w.rows).toBe(null);
    for (const g of w.groups) {
      expect(keys(g)).toEqual(['key', 'label', 'previous', 'share', 'value']);
      expect(keys(g.previous)).toEqual(FIGURE);
    }
    expect(w.groups.reduce((n: number, g: Json) => n + g.value.value, 0)).toBe(w.total.value);
  });

  it('agrees with the list on closures by outcome over the last quarter, and drills to one group\'s rows', async () => {
    const w = await read(MEMBER, `work/query?measure=closures&by=outcome&${LAST_QUARTER()}`);
    const list = await read(MEMBER, 'initiatives');
    const closed = list.tiles.closed;
    expect(Object.fromEntries(w.groups.map((g: Json) => [g.key, g.value.value]))).toEqual(Object.fromEntries(Object.entries(closed).filter(([, n]) => n)));
    const drill = await read(MEMBER, `work/query?measure=closures&by=outcome&${LAST_QUARTER()}&group=accepted`);
    const rows = ok(drill.rows);
    expect(rows.total).toBe(closed.accepted);
    for (const r of rows.rows) expect(keys(r)).toEqual(ROW);
  });

  it('groups by period at the grain the window asks for', async () => {
    const week = await read(MEMBER, 'work/query?measure=words&by=period');
    expect(week.grain).toBe('week');
    const year = new Date();
    const long = await read(MEMBER, `work/query?measure=runs&by=period&from=${new Date(year.getTime() - 365 * 24 * 3_600_000).toISOString()}&to=${year.toISOString()}`);
    expect(long.grain).toBe('month');
  });

  it('answers each person their own approvals alone', async () => {
    const q = `work/query?measure=approvals&by=presentation&${LAST_QUARTER()}`;
    const [ava, noah] = [await read(SUPERADMIN, q), await read(MEMBER, q)];
    expect(ava.total.value).toBeGreaterThan(noah.total.value);
    expect(ava.meta.scope).toBe('caller-in-active-team');
  });

  it('refuses an unknown measure or dimension with the allowed values, before anything is read', async () => {
    for (const [path, names] of [
      ['work/query?measure=bytes&by=period', 'closures, opened, words, approvals, lessons, runs, searches'],
      ['work/query?measure=words&by=skill', 'document, initiative, period'],
      ['work/query?measure=runs&by=nothing', 'skill, initiative, weekday, hour, period'],
    ]) {
      const res = await ask(MEMBER, path);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain(names);
    }
  });
});
