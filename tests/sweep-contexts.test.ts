// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

// The fake gateway's clock is the moment its module loads, so the day is fixed before it does: Knowledge health's busiest
// weeks are then named in September and October, whatever day the suite runs on.
vi.hoisted(() => { vi.useFakeTimers({ now: new Date('2026-10-19T04:00:00Z'), toFake: ['Date'] }); });
import type { InitiativeDetail, Me } from '@/lib/api-shapes';
import type { KnowledgeHealth, Usage } from '@/lib/fleet-shapes';
import { contextText, type SharedContext } from '@/lib/shared-context';
import type { RecordRead } from '@/lib/work-shapes';
import { CONTEXT_BUDGET } from '@/views/context';
import { initiativeContext } from '@/views/initiative-context';
import { sourceName } from '@/views/initiative-name';
import { knowledgeHealthContext } from '@/views/platform-knowledge-context';
import { usageContext } from '@/views/platform-usage-context';
import { RECORD_DEFAULTS, SLICES, recordContext, type SliceKey } from '@/views/record-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { usage } from '../scripts/fake-gateway/platform-usage.ts';
import { empty, extreme } from '../scripts/fake-gateway/states.ts';
import { NOT_RECORDED, partial } from '../scripts/fake-gateway/states-partial.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';
import { initiativeDetail } from '../scripts/fake-gateway/work-initiatives.ts';

/**
 * Every section a page draws is in the context its assistant is told (Phase 7's third re-review, Work P-2 and P-3,
 * Platform P-1): Record's, an initiative's, Usage's and Knowledge health's, built from the fake gateway's own answers
 * as each person and in each state the fake draws, carry each section with a few of its rows and the rest counted, or
 * name it in the Unknown as on the page only. A superadmin's extra sections may not crowd one out unsaid, so the
 * budget's own "More is on the page" never stands in for a section's name.
 */
const PEOPLE: [string, Me][] = [['superadmin', ME], ['member', MEMBER]];
const STATES = ['normal', 'empty', 'extreme', 'partial'] as const;
type State = (typeof STATES)[number];
const UNSAID = 'More is on the page than fits here';
const SLUG = '2026-09-28-search-relevance';

/** A route's answer as the fake gateway serves it to `who` in `state`, or null where that state answers the page's
 *  missing record. */
function served<T>(state: State, who: Me, seg: string[], body: unknown, q = new URLSearchParams()): T | null {
  const shaped = state === 'normal' ? body
    : state === 'empty' ? empty(seg, body, q)
      : state === 'extreme' ? extreme(seg, body, who.superadmin ? null : who.activeTeam, q, who.activeTeam)
        : partial(seg, body);
  return shaped === NOT_RECORDED ? null : (shaped as T);
}

const recordOf = (state: State, who: Me) => served<RecordRead>(state, who, ['record'], record(who, new URLSearchParams('period=all'))[1], new URLSearchParams('period=all'));
const initiativeOf = (state: State, who: Me) => served<InitiativeDetail>(state, who, ['initiatives', 'atlas', SLUG], initiativeDetail('atlas', SLUG));
const usageOf = (state: State, who: Me) => served<Usage>(state, who, ['platform', 'usage'], usage(who.superadmin));
const healthOf = (state: State, who: Me) => served<KnowledgeHealth>(state, who, ['platform', 'knowledge'], knowledge(who.superadmin, who.activeTeam));

const arrival = { updatedAt: '2026-10-20T06:00:00Z', now: '2026-10-20T06:01:00Z' };
/** The facts and insights the context is told, a line each, without the Unknown. */
const told = (c: SharedContext) => contextText({ ...c, unknowns: [] }).split('\n').filter((l) => l.startsWith('- '));
const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Where a context says a section by its chart's label rather than its card's title, as the page labels both. */
const LABELLED: Record<string, string> = {
  'Searches with no result by week': 'Share of searches with no result by week',
  'Lessons by kind': 'Standing lessons by kind',
};
/**
 * The line the context carries a section on: a fact or an insight naming it by the page's own words, with what it says
 * after it. Words added by week reads as its figures, so the lead's running total, a chart of its own, is not it.
 */
const carried = (c: SharedContext, name: string) => {
  const at = new RegExp(name === 'Words added' ? 'Words added (\\d|none|too few|unavailable)' : `${escaped(LABELLED[name] ?? name)}[ :,(]`);
  return told(c).find((l) => at.test(l));
};
/** Whether the Unknown names `name` as a section on the page only. */
const pageOnly = (c: SharedContext, name: string) => c.unknowns.some((u) => u.startsWith('On the page only') && u.includes(name));

/** The sections Record draws, by the slice each is drawn in; a slice that could not be read says so in its place. */
const RECORD: [SliceKey | 'record', string][] = [
  ['work', 'Closures in all'], ['work', 'Closures by outcome'], ['work', 'Median hours to close'], ['work', 'A typical piece of work'],
  ['documents', 'Words added'], ['documents', 'Most rewritten documents'],
  ['knowledge', 'Searches with results'], ['knowledge', 'What searches returned'], ['knowledge', 'Lessons made in all'], ['knowledge', 'Lessons adopted, by kind'],
  ['agents', 'Weekday by hour'], ['agents', 'Every day'], ['agents', 'Runs by skill'],
  ['firsts', 'Dated firsts'],
  ['record', 'The record\'s rows'],
];
const USAGE = ['Calls by week', 'Refusals put right', 'The platform\'s own traffic', 'All refusals by population', 'Each tool\'s median call', 'Weekday by hour', 'Tools called most', 'Calls per recorded approval', 'The platform\'s model calls'];
const HEALTH = ['Each shelf', 'Lessons made by week', 'Searches with no result by week', 'Lessons by the week made', 'Lessons by kind'];

/** Every person in every state, with the context built from what the fake serves them there. */
function cases<T>(of: (state: State, who: Me) => T | null) {
  return PEOPLE.flatMap(([person, who]) => STATES.map((state) => ({ person, who, state, data: of(state, who) })))
    .filter((c): c is { person: string; who: Me; state: State; data: T } => c.data !== null);
}

describe('each context is inside its budget, for each person and state, and names every dropped section', () => {
  const all: [string, () => { person: string; state: State; context: SharedContext }[]][] = [
    ['Record', () => cases(recordOf).map((c) => ({ ...c, context: recordContext(c.data, { filters: RECORD_DEFAULTS }) }))],
    ['An initiative', () => cases(initiativeOf).map((c) => ({ ...c, context: initiativeContext(c.data, arrival) }))],
    ['Usage', () => cases(usageOf).map((c) => ({ ...c, context: usageContext({ state: 'ok', usage: c.data }) }))],
    ['Knowledge health', () => cases(healthOf).map((c) => ({ ...c, context: knowledgeHealthContext({ state: 'ok', health: c.data }) }))],
  ];
  it.each(all)('%s', (_, built) => {
    for (const { person, state, context } of built()) {
      const text = contextText(context);
      expect(text.length, `${person}, ${state}`).toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(text, `${person}, ${state}`).not.toContain(UNSAID);
    }
  });
});

describe('the superadmin\'s context tells every section the member\'s tells (Platform P-1)', () => {
  const both: [string, (who: Me) => SharedContext, string[]][] = [
    ['Record', (who) => recordContext(recordOf('normal', who)!, { filters: RECORD_DEFAULTS }), RECORD.map(([, name]) => name)],
    ['Usage', (who) => usageContext({ state: 'ok', usage: usageOf('normal', who)! }), USAGE],
    ['Knowledge health', (who) => knowledgeHealthContext({ state: 'ok', health: healthOf('normal', who)! }), HEALTH],
  ];
  it.each(both)('%s', (_, build, names) => {
    const [admin, member] = [build(ME), build(MEMBER)];
    for (const name of names) if (carried(member, name)) expect(carried(admin, name), name).toBeTruthy();
  });
});

describe('Record\'s context carries every section of its page, or names it as on the page only (Work P-2)', () => {
  it.each(cases(recordOf).map((c) => [c.person, c.state, c.data] as const))('as the %s, %s', (_, state, r) => {
    const c = recordContext(r, { filters: RECORD_DEFAULTS });
    for (const [slice, name] of RECORD) {
      const unread = slice === 'record' ? r.record.state !== 'ok' : r[slice].state !== 'ok';
      if (unread) {
        expect(c.unknowns, name).toContain(slice === 'record' ? 'The record of initiatives could not be read.' : SLICES[slice].unread);
        continue;
      }
      // A record with no initiative draws the table's empty state, which the record's summary says as its zero.
      if (slice === 'record' && r.record.state === 'ok' && !r.record.data.rows.length) continue;
      expect(carried(c, name) ?? pageOnly(c, name), `${name} (${state})`).toBeTruthy();
    }
  });

  it('as both people in the normal state, names the weeks of each series and the record\'s first rows, and the two heatmaps as the page\'s alone', () => {
    for (const [person, who] of PEOPLE) {
      const r = recordOf('normal', who)!;
      const c = recordContext(r, { filters: RECORD_DEFAULTS });
      const w = r.work.state === 'ok' ? r.work.data : null;
      const k = r.knowledge.state === 'ok' ? r.knowledge.data : null;
      const rows = r.record.state === 'ok' ? r.record.data.rows : [];
      expect(w && k && rows.length, person).toBeTruthy();
      // The charts by week, their weeks said once, each chart's figures in their order.
      const charts = told(c).find((l) => l.startsWith('- The charts by week, the newest 3 of 8 ('));
      for (const name of ['Closures by outcome', 'Median hours to close', 'Searches with results', 'Lessons made in all', 'Closures in all', 'Words added']) {
        expect(charts, `${person}: ${name}`).toMatch(new RegExp(`[:;] ${name} (\\d|none)`));
      }
      expect(carried(c, 'The record\'s rows'), person).toContain(rows[0].slug);
      expect(carried(c, 'The record\'s rows'), person).toContain(`of ${r.record.state === 'ok' ? r.record.data.total : 0}`);
      expect(pageOnly(c, 'Weekday by hour') && pageOnly(c, 'Every day'), person).toBe(true);
    }
  });
});

describe('an initiative\'s context names its sources with the document each supports, and where its decisions are (Work P-3)', () => {
  it.each(cases(initiativeOf).map((c) => [c.person, c.state, c.data] as const))('as the %s, %s', (_, state, d) => {
    const c = initiativeContext(d, arrival);
    const sources = d.documents.filter((x) => x.path.startsWith('sources/'));
    if (sources.length) {
      const line = carried(c, 'Sources');
      expect(line ?? pageOnly(c, 'Sources'), state).toBeTruthy();
      // A few by name, the rest counted.
      if (line) expect(sources.filter((s) => line.includes(sourceName(s.title, s.path).name.slice(0, 20))).length + Number(line.match(/and (\d+) more/)?.[1] ?? 0)).toBe(sources.length);
    }
    if (d.decisionCounts.rows) {
      const line = carried(c, 'Decisions');
      expect(line, state).toBeTruthy();
      for (const path of new Set(d.decisions.map((x) => x.path))) expect(line, state).toContain(path);
    }
  });

  it('names all five sources in the normal state, each with the document it supports', () => {
    const d = initiativeOf('normal', ME)!;
    const line = carried(initiativeContext(d, arrival), 'Sources')!;
    for (const s of d.documents.filter((x) => x.path.startsWith('sources/'))) expect(line).toContain(`${sourceName(s.title, s.path).name} (${s.supports})`);
  });
});

describe('Usage\'s context carries every section, the superadmin\'s as the member\'s (Platform P-1)', () => {
  it.each(cases(usageOf).map((c) => [c.person, c.state, c.data] as const))('as the %s, %s', (_, state, u) => {
    const c = usageContext({ state: 'ok', usage: u });
    for (const name of USAGE) {
      expect(carried(c, name) ?? pageOnly(c, name) ?? false, `${name} (${state})`).toBeTruthy();
    }
  });

  it('tells both people each tool\'s median call in the normal state', () => {
    for (const [person, who] of PEOPLE) {
      const u = usageOf('normal', who)!;
      const first = u.tools.state === 'ok' ? u.tools.data.rows[0].tool : 'none';
      expect(carried(usageContext({ state: 'ok', usage: u }), 'Each tool\'s median call'), person).toContain(first);
    }
  });
});

describe('Knowledge health\'s context carries every section, the superadmin\'s as the member\'s (Platform P-1)', () => {
  it.each(cases(healthOf).map((c) => [c.person, c.state, c.data] as const))('as the %s, %s', (_, state, h) => {
    const c = knowledgeHealthContext({ state: 'ok', health: h });
    for (const name of [...HEALTH, ...(h.questions ? ['Questions with no result'] : [])]) {
      expect(carried(c, name) ?? pageOnly(c, name) ?? false, `${name} (${state})`).toBeTruthy();
    }
  });

  it('tells both people the lessons by the week made and by kind in the normal state', () => {
    for (const [person, who] of PEOPLE) {
      const c = knowledgeHealthContext({ state: 'ok', health: healthOf('normal', who)! });
      expect(carried(c, 'Lessons by the week made'), person).toMatch(/\d{1,2} (Sept|Oct)/);
      expect(carried(c, 'Lessons by kind'), person).toMatch(/\d/);
    }
  });
});
