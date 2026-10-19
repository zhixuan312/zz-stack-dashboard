import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
const access = vi.hoisted(() => ({ team: 'atlas' as string | null, allowed: true }));
vi.mock('@/data/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/access')>()),
  requireNeed: async () => { if (!access.allowed) throw new Error('not permitted'); },
  chromeAccess: async () => ({ only: ['/'], user: { name: 'Ava', role: 'Superadmin' }, team: access.team, caller: 'ava.lindqvist@example.com' }),
}));

import { FEATURES } from '@/data/features';
import { formatDay } from '@/lib/format-date';
import { PREPARED } from '@/data/prepared';
import { CONTEXT_BUDGET } from '@/views/context';
import { contextText } from '@/lib/shared-context';
import type { Home } from '@/lib/work-shapes';
import { homeContext, type HomeRead } from '@/views/home-context';
import { homeTool } from '@/views/tools/home';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';

/**
 * What the page and the assistant are both told about Home, from the one response its page reads: the title, the week
 * the cursor points at with both figures, what waits, each open initiative's next move and the coverage of the words,
 * and what `view_home` and `explore_home` answer.
 */
const ATLAS = homeOf('atlas', ME.email);
const BEACON = homeOf('beacon', MEMBER.email);
const ok = (home: Home, team: string | null = 'atlas'): HomeRead => ({ state: 'ok', home, team });
const fact = (c: ReturnType<typeof homeContext>, label: string) => c.facts.find((f) => f.label === label);
/** The fixture's weeks move with the day it is run: every date and count here is read off its own answer. */
const WEEKS = { words: ATLAS.words.state === 'ok' ? ATLAS.words.data.weeks : [], approvals: ATLAS.approvals.state === 'ok' ? ATLAS.approvals.data.weeks : [] };
const day = (i: number) => formatDay(WEEKS.words[i].window.from);
const LAST = formatDay(ATLAS.tiles.closed.window.from);
const approvalsAt = (i: number) => { const n = WEEKS.approvals[i].figure.value!; return `${n} ${n === 1 ? 'approval' : 'approvals'} in your name`; };

beforeEach(() => { gateway.get.mockReset(); access.team = 'atlas'; access.allowed = true; });

describe('view_home', () => {
  it('answers the same Home response its page reads, told through the same context', async () => {
    gateway.get.mockResolvedValue(ATLAS);
    const { data, context } = await homeTool.read({});
    expect(gateway.get).toHaveBeenCalledWith('/home');
    expect(data).toEqual(ATLAS);
    expect(context).toEqual(homeContext(ok(ATLAS)));
  });

  it('is the home feature\'s, titled Home, at /, and refuses where its page would', async () => {
    expect(homeTool).toMatchObject({ name: 'home', title: 'Home', page: '/', needs: FEATURES.home.needs });
    access.allowed = false;
    await expect(homeTool.read({})).rejects.toThrow('not permitted');
    expect(gateway.get).not.toHaveBeenCalled();
  });
});

describe('explore_home', () => {
  it('declares Work\'s measures over /work/query: closures, opened, words, approvals and runs', () => {
    const sources = homeTool.explore.sources;
    expect(Object.keys(sources)).toEqual(['closures', 'opened', 'words', 'approvals', 'runs']);
    for (const s of Object.values(sources)) {
      const row = PREPARED.find((r) => r.name === s.collection);
      expect(row, s.collection).toBeDefined();
      expect(row!.route, s.collection).toBe('work');
    }
  });
});

describe('the shared context', () => {
  it('carries the title as the gateway wrote it, last week\'s two figures, the estimate and the tiles', () => {
    const c = homeContext(ok(ATLAS));
    expect(c).toMatchObject({ view: 'home', title: 'Home', address: '/' });
    expect(fact(c, 'Title')!.value).toBe(ATLAS.title.sentence);
    // Last week's figure, then the series its chart draws, oldest first (Work M-9); the scope names the week.
    expect(fact(c, 'Words added')).toMatchObject({ value: '15,400 last week', change: expect.stringMatching(/^by week: .*12,400; .*none;.* 2,100 so far$/) });
    const last = WEEKS.approvals.find((w) => w.window.from === ATLAS.tiles.closed.window.from)!.figure.value!;
    expect(fact(c, 'Approvals in your name')!.value).toBe(`${last} last week`);
    for (const w of WEEKS.approvals) expect(fact(c, 'Approvals in your name')!.change).toContain(`${formatDay(w.window.from)} ${w.figure.value}`);
    expect(fact(c, 'One person, writing this')!.value).toBe('31 h, estimated at 500 words an hour');
    expect(fact(c, 'Searches with results')).toMatchObject({ value: '75%', change: '12 of 16 searches' });
    expect(c.scope).toBe(`${ATLAS.meta.population}, the week of ${LAST}`);
  });

  it('says what waits, each open initiative\'s next move, and what the words are counted over', () => {
    const text = contextText(homeContext(ok(ATLAS)));
    expect(text).toContain('4 revisions wait for approval, the oldest since');
    // Neighbours with the same next move are one entry, every slug named (Work M-9).
    const rows = ATLAS.openWork.state === 'ok' ? ATLAS.openWork.data.rows : [];
    for (const r of rows) expect(text).toContain(r.slug);
    for (const r of rows) expect(text).toContain(`Approve ${r.nextMove!.document}, waiting on a person`);
    expect(text).toContain('Words added count 41 documents, never less what a later revision removed; 2 made by an import left out, 1 with no recorded write, 1 missing an earlier revision.');
    expect(text).not.toContain('More is on the page');
    expect(text).toContain(`${ATLAS.words.state === 'ok' ? ATLAS.words.data.finding!.text : ''}.`);
    expect(text.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('names the one revision waiting, with the document it opens', () => {
    const c = homeContext(ok(BEACON, 'beacon'));
    const waiting = c.insights.find((i) => i.text.startsWith('spec.md, version 1, waits for approval'));
    expect(waiting?.evidence).toBe('/initiatives/beacon/2026-09-30-refund-flow/spec.md');
    expect(fact(c, 'Title')!.value).toBe('Your first observed week: 1 closure and 2 lesson adoptions');
  });

  it('is refreshed when the cursor moves: the week pointed at with both figures, the running week so far', () => {
    const running = WEEKS.words.length - 1;
    expect(homeContext(ok(ATLAS)).focus).toBeUndefined();
    expect(WEEKS.words[1].figure.value).toBeNull();
    expect(homeContext(ok(ATLAS), { index: 1 }).focus).toBe(`the week of ${day(1)}: no words recorded, ${approvalsAt(1)}`);
    expect(homeContext(ok(ATLAS), { index: running }).focus).toBe(`the week of ${day(running)}: 2,100 words added so far, ${approvalsAt(running)} so far`);
  });

  it('is refreshed when the team switches: the other team\'s week, what waits and work, nothing of the first', () => {
    const atlas = homeContext(ok(ATLAS));
    const beacon = homeContext(ok(BEACON, 'beacon'));
    expect(contextText(beacon)).not.toBe(contextText(atlas));
    expect(beacon.scope).toContain(BEACON.meta.population);
    // The open work is the team's own (the fake's runs active now are one fixture for every team, so they are not read here).
    const work = (c: typeof atlas) => c.insights.find((i) => i.evidence === '/initiatives')!.text;
    expect(work(beacon)).toContain('2026-09-30-refund-flow');
    for (const r of ATLAS.openWork.state === 'ok' ? ATLAS.openWork.data.rows : []) expect(work(beacon)).not.toContain(r.slug);
  });

  it('says a part that could not be read is unknown, never an all-clear, and a read that failed has no figure', () => {
    const gone = { state: 'unavailable', reason: 'query_failed' } as const;
    const c = homeContext(ok({ ...ATLAS, waiting: gone, words: gone, foot: { ...ATLAS.foot, estimate: null } }));
    expect(c.unknowns).toContain('What waits for approval could not be read, so nothing can be said about it; it is not an all-clear.');
    expect(fact(c, 'Words added')!.value).toBe('unavailable');
    expect(fact(c, 'One person, writing this')!.value).toBe('Unavailable');
    const failed = homeContext({ state: 'failed' });
    expect(failed.facts).toEqual([]);
    expect(failed.unknowns[0]).toContain('Home did not load');
  });
});
