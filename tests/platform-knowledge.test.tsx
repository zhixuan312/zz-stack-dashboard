import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { isValidElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/platform/knowledge',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push() {}, replace() {}, refresh: router.refresh, back() {}, forward() {}, prefetch() {} }),
}));
const gateway = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/data/gateway', async (load) => ({ ...(await load<typeof import('@/data/gateway')>()), gatewayGet: gateway.get }));
// The refusal the console declares (Task I-94): a refused address names nothing.
vi.mock('@/app.config', async (load) => ({ ...(await load<typeof import('@/app.config')>()), refusal: 'absent' }));

import { SurfaceOverride } from '@/components/base/surface';
import { FEATURES } from '@/data/features';
import { GatewayError } from '@/data/gateway';
import { PREPARED } from '@/data/prepared';
import { aggregate, read as readCollection } from '@/data/read';
import { MAIN_ROLES, effective } from '@/data/roles';
import type { Me } from '@/lib/api-shapes';
import { exploreSchema, runExplore, type ExploreRights } from '@/lib/explore';
import type { KnowledgeHealth } from '@/lib/fleet-shapes';
import { formatDateTime, formatDay } from '@/lib/format-date';
import type { Part, Window } from '@/lib/platform-shapes';
import { contextText } from '@/lib/shared-context';
import { CONTEXT_BUDGET } from '@/views/context';
import { KnowledgeHealthAsOf, PlatformKnowledgeView } from '@/views/pages/platform-knowledge';
import { KNOWLEDGE_HEALTH_BOUND_MS, knowledgeHealthContext, type KnowledgeHealthRead } from '@/views/platform-knowledge-context';
import { knowledgeHealthTool } from '@/views/tools/knowledge-health';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { knowledge } from '../scripts/fake-gateway/platform-knowledge.ts';
import { platformQuery } from '../scripts/fake-gateway/platform-query.ts';
import { TEAMS } from '../scripts/fake-gateway/platform-teams.ts';
import PlatformKnowledgeLoading from '../app/(dash)/platform/knowledge/loading';
import PlatformKnowledgePage, { generateMetadata } from '../app/(dash)/platform/knowledge/page';
import { readKnowledgeHealth } from '../app/(dash)/platform/knowledge/read-knowledge';

/**
 * Knowledge health under Platform (Task I-103): the page drawn from the fake gateway's own answer as the superadmin and
 * as a member, read first on the console's server; the four tiles, each shelf, the lessons made by week outside the
 * import cohorts with the week imports are told exactly from and what each week left out by the day rule, the share of
 * searches with no result by week with the share widened and the mean results, the lessons by the week made with the
 * cohort labelled `imported, by day`, the lessons by kind, and the questions with no result for the superadmin alone.
 * A member's page names no shelf but their own and the shared one; every state draws; the Ask sits in the head of the
 * shelves' table; and `view_knowledge_health` with `explore_knowledge_health` answer as the page does.
 */
const ADMIN = knowledge(true, ME.activeTeam);
const MEMBER_READ = knowledge(false, MEMBER.activeTeam);
const ok = (health: KnowledgeHealth): KnowledgeHealthRead => ({ state: 'ok', health });
/** A part the fixture answers, which is every one of them. */
function data<T>(p: Part<T> | null): T {
  if (!p || p.state !== 'ok') throw new Error('not answered');
  return p.data;
}
const WEEKS = data(ADMIN.made).weeks;
/** The day the fixture's week `i` starts, as a sentence writes it. */
const day = (i: number) => formatDay(WEEKS[i].window.from);
const QUESTIONS = data(ADMIN.questions).rows;
/** Every team the member is not in, by slug and by name, as whole words; and the shared shelf's slug. */
const OTHERS = TEAMS.filter((t) => t.slug !== MEMBER.activeTeam).flatMap((t) => [t.slug, t.name]);
const NAMED = new RegExp(`\\b(${[...OTHERS, 'zz-platform', MEMBER.activeTeam!].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

/** The view as the shell holds it: inside the tooltip provider, on the console's surface, with an assistant when `ask` is given. */
const draw = (r: KnowledgeHealthRead, ask?: (q: string) => void) =>
  render(<SurfaceOverride surface={ask ? { ask } : {}}><Tooltip.Provider><PlatformKnowledgeView read={r} /></Tooltip.Provider></SurfaceOverride>);
const card = (title: string) => screen.getByRole('heading', { name: title }).closest('section, .card') as HTMLElement;
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((r) => r.textContent);

/** The gateway as the fake answers `who`: who they are, their Knowledge health, and Platform's prepared query. */
function answering(who: Me) {
  gateway.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://gateway.test');
    if (url.pathname === '/me') return who;
    if (url.pathname === '/platform/knowledge') return knowledge(who.superadmin, who.activeTeam);
    if (url.pathname === '/platform/query') {
      const [status, body] = platformQuery(who, url.searchParams) as [number, { error?: string }];
      if (status !== 200) throw new GatewayError(status, body.error ?? 'refused');
      return body;
    }
    throw new GatewayError(404, `no route ${url.pathname}`);
  });
}

beforeEach(() => { router.refresh.mockReset(); gateway.get.mockReset(); });
afterEach(() => vi.useRealTimers());

describe('who opens Knowledge health', () => {
  it('needs platform:read, which both roles hold', () => {
    expect(FEATURES['knowledge-health']).toEqual({ title: 'Knowledge health', needs: 'platform:read' });
    for (const role of MAIN_ROLES) expect(effective(role).has('platform:read'), role).toBe(true);
  });
});

describe('the page, as the fake gateway answers the superadmin', () => {
  it('draws the four tiles: the lessons adopted, and last week\'s lessons made, searches and share with no result', () => {
    const { container } = draw(ok(ADMIN));
    for (const label of ['Lessons adopted', 'Made last week', 'Searches last week', 'Share with no result']) expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    const values = [...container.querySelectorAll('[data-figures="read"] [data-value]')].map((v) => v.textContent);
    expect(values).toEqual(['142', '3', '40', '10.0%']);
  });

  it('draws each shelf by slug, the superadmin\'s own and the shared one marked, and the totals last', () => {
    draw(ok(ADMIN));
    const rows = rowsOf(screen.getByRole('table', { name: 'Each shelf\'s lessons and last week\'s searches' }));
    expect(rows).toHaveLength(5);
    // Each row as its phone card says it, which carries every figure the row's columns do.
    const said = [
      ['atlas (your team)', '11 standing, 1 superseded, 2 imported', 'Last week: 1 made, 28 searches, 10.7% with no result, too few to judge'],
      ['beacon', '2 standing, 0 superseded, 0 imported', 'Last week: 0 made, 12 searches, 8.3% with no result, too few to judge'],
      ['cinder', '1 standing, 0 superseded, 0 imported', 'Last week: 0 made, no searches', 'No searches'],
      ['zz-platform (shared)', '128 standing, 14 superseded, 120 imported', 'Last week: 2 made, no searches', 'No searches'],
      ['All shelves', '142 standing, 15 superseded, 122 imported', 'Last week: 3 made, 40 searches, 10.0% with no result'],
    ];
    said.forEach(([name, ...facts], i) => {
      expect(rows[i]!.startsWith(name), name).toBe(true);
      for (const f of facts) expect(rows[i], name).toContain(f);
    });
  });

  it('draws the lessons made by week outside the import cohorts, the week imports are told exactly from, and each week\'s left out by the day rule', () => {
    draw(ok(ADMIN));
    const made = card('Lessons made by week');
    expect(made.querySelectorAll('[data-column]')).toHaveLength(WEEKS.length);
    expect(made.textContent).toContain(`Imports are told exactly from the week of ${day(3)}; before it, by the day rule, labelled imported, by day`);
    expect(made.querySelector('[data-left-out]')!.textContent).toBe(`Left out as imports: the week of ${day(1)}, 96 by the day rule; the week of ${day(4)}, 24 told exactly.`);
    // The line under the chart reads the last whole week, then the week the cursor points at.
    const line = () => made.querySelector('[data-made]')!.textContent;
    expect(line()).toContain(`The week of ${day(4)}`);
    expect(line()).toContain('Made3 lessons');
    expect(line()).toContain('Imported, exactly24 left out');
    fireEvent.keyDown(made.querySelector('[data-plot]')!, { key: 'Home' });
    fireEvent.keyDown(made.querySelector('[data-plot]')!, { key: 'ArrowRight' });
    expect(line()).toContain(`The week of ${day(1)}`);
    expect(line()).toContain('Made0 lessons');
    expect(line()).toContain('Imported, by day96 left out');
  });

  it('draws the share of searches with no result by week, with the share widened and the mean results, on the lessons\' cursor', () => {
    draw(ok(ADMIN));
    const searches = card('Searches with no result by week');
    expect(searches.querySelectorAll('[data-column]')).toHaveLength(WEEKS.length);
    expect(searches.querySelectorAll('[data-column][data-no-data]')).toHaveLength(2);
    const line = () => searches.querySelector('[data-searches]')!.textContent;
    expect(line()).toContain('No result10.0% of 40 searches');
    expect(line()).toContain('Widened10.0% of 40 searches');
    expect(line()).toContain('Mean results5.6 a search');
    fireEvent.keyDown(card('Lessons made by week').querySelector('[data-plot]')!, { key: 'Home' });
    fireEvent.keyDown(card('Lessons made by week').querySelector('[data-plot]')!, { key: 'ArrowRight' });
    fireEvent.keyDown(card('Lessons made by week').querySelector('[data-plot]')!, { key: 'ArrowRight' });
    expect(line()).toContain(`The week of ${day(2)}`);
    expect(line()).toContain('No result25.0%, too few of 8 searches');
    expect(line()).toContain('WidenedUnavailable');
  });

  it('draws the lessons by the week made with the cohort labelled imported, by day, and those superseded since', () => {
    draw(ok(ADMIN));
    const cohorts = card('Lessons by the week made');
    expect(within(cohorts).getByTitle(`Week of ${day(1)}: 96 made · 96 imported, by day · 9 superseded since`)).toBeInTheDocument();
    expect(within(cohorts).getByTitle(`Week of ${day(4)}: 27 made · 24 imported · 1 superseded since`)).toBeInTheDocument();
    expect(within(cohorts).getByTitle(`Week of ${day(0)}: 2 made · 1 superseded since`)).toBeInTheDocument();
  });

  it('draws the lessons by kind', () => {
    draw(ok(ADMIN));
    const kinds = card('Lessons by kind');
    for (const k of data(ADMIN.byKind)) expect(within(kinds).getByTitle(k.kind).closest('li')!.textContent).toContain(String(k.standing));
  });

  it('draws the questions with no result, most asked first, for the superadmin', () => {
    draw(ok(ADMIN));
    const table = screen.getByRole('table', { name: 'Questions the searches that found nothing asked' });
    const rows = rowsOf(table);
    expect(rows).toHaveLength(QUESTIONS.length);
    QUESTIONS.forEach((q, i) => { expect(rows[i]).toContain(q.question); expect(rows[i]).toContain(q.shelf); });
    expect(card('Questions with no result').textContent).toContain('4 shown of 4');
  });

  it('calls no movement good or bad, on the page or to the assistant', () => {
    for (const h of [ADMIN, MEMBER_READ]) {
      const { container, unmount } = draw(ok(h));
      expect(container.textContent).not.toMatch(/\b(better|worse|improv\w*|good|bad|healthy|worsen\w*)\b/i);
      // No figure takes a status colour for being higher or lower.
      expect(container.querySelector('[class*="text-positive"], [class*="text-critical"], [class*="bg-positive"], [class*="bg-critical"]')).toBeNull();
      unmount();
      expect(contextText(knowledgeHealthContext(ok(h))).replace('are not better or worse', '')).not.toMatch(/\b(better|worse|improv\w*|good|bad|healthy)\b/i);
    }
  });
});

describe('the page, as a member reads it', () => {
  it('names no shelf but their own and the shared one, and the totals', () => {
    draw(ok(MEMBER_READ));
    const rows = rowsOf(screen.getByRole('table', { name: 'Each shelf\'s lessons and last week\'s searches' }));
    expect(rows).toHaveLength(3);
    ['Your team\'s shelf', 'The shared shelf', 'All shelves'].forEach((name, i) => expect(rows[i]!.startsWith(name), name).toBe(true));
  });

  it('names no other team, not even its own by slug, and asks no question', () => {
    const { container } = draw(ok(MEMBER_READ));
    expect(NAMED.exec(container.textContent!)?.[0]).toBeUndefined();
    for (const q of QUESTIONS) expect(container.textContent).not.toContain(q.question);
    expect(screen.queryByRole('heading', { name: 'Questions with no result' })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Questions the searches that found nothing asked' })).toBeNull();
  });

  it('still draws every other card', () => {
    draw(ok(MEMBER_READ));
    for (const title of ['Lessons made by week', 'Searches with no result by week', 'Lessons by the week made', 'Lessons by kind']) expect(card(title)).toBeTruthy();
  });
});

describe('the page\'s states', () => {
  it('loading: the page\'s shape, announced as busy, naming no page under the absent refusal', () => {
    const { container } = render(<Tooltip.Provider><PlatformKnowledgeLoading /></Tooltip.Provider>);
    expect(screen.getByRole('status', { name: 'Loading page' })).toHaveAttribute('aria-busy', 'true');
    expect(container.textContent).not.toMatch(/knowledge|shelf|lesson/i);
  });

  it('partial: a part that is unavailable draws its own state and the rest stands', () => {
    draw(ok({ ...ADMIN, cohorts: { state: 'unavailable', reason: 'the lessons did not answer' }, searches: { state: 'unavailable', reason: 'no searches' } }));
    expect(screen.getByText('Lessons by the week made: unavailable')).toBeInTheDocument();
    expect(screen.getByText('Searches with no result by week: unavailable')).toBeInTheDocument();
    expect(screen.getByText(/the lessons did not answer/)).toBeInTheDocument();
    expect(card('Lessons made by week')).toBeTruthy();
    expect(card('Each shelf')).toBeTruthy();
  });

  it('keeps the Ask on the shelves when they are unavailable', () => {
    draw(ok({ ...ADMIN, shelves: { state: 'unavailable', reason: 'timeout' } }), vi.fn());
    expect(screen.getByText('Each shelf: unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ask: / }).closest('[data-protagonist="Each shelf"]')).not.toBeNull();
  });

  it('a superadmin whose questions could not be read is told so, in the questions\' own card', () => {
    draw(ok({ ...ADMIN, questions: { state: 'unavailable', reason: 'the questions did not answer' } }));
    expect(screen.getByText('Questions with no result: unavailable')).toBeInTheDocument();
  });

  it('draws a missing week as missing, never as zero', () => {
    const at = 2;
    const made = data(ADMIN.made);
    const gap: KnowledgeHealth = { ...ADMIN, made: { state: 'ok', data: { ...made, weeks: made.weeks.map((w, i) => (i === at ? { ...w, made: { value: null, why: 'unavailable' } } : w)) } } };
    draw(ok(gap));
    const columns = card('Lessons made by week').querySelectorAll('[data-column]');
    expect(columns[at].hasAttribute('data-no-data'), 'the gap').toBe(true);
    expect(columns[1].hasAttribute('data-no-data'), 'a week with nothing made is zero, not missing').toBe(false);
    // The context says the gap in the chart's own word for it, so the agent and the column agree (I-167, M-6).
    expect(contextText(knowledgeHealthContext(ok(gap)))).toContain('oldest first: 2, 0, No data, 2, 3, 1 so far');
  });

  it('says a tile with no figure in words, never a zero, and a change that cannot stand as the week before', () => {
    const tiles = data(ADMIN.tiles);
    const none = { ...tiles.noResult, last: { ...tiles.noResult.last, figure: { value: null, why: 'no_data' as const }, denominator: 0 } };
    const { container } = draw(ok({ ...ADMIN, tiles: { state: 'ok', data: { ...tiles, noResult: none } } }));
    const tile = [...container.querySelectorAll('[data-figures="read"] [data-value]')][3];
    expect(tile.textContent).toBe('No data');
    expect(tile.closest('.card')!.textContent).toContain(`The week of ${day(3)}: 15.0%`);
  });

  it('nothing yet: a fresh deployment draws zeros where zero is counted and says each list is empty', () => {
    const zero = { value: 0, why: null } as const;
    const fresh: KnowledgeHealth = {
      ...ADMIN,
      shelves: { state: 'ok', data: { rows: data(ADMIN.shelves).rows.map((r) => ({ ...r, standing: 0, superseded: 0, imported: 0, madeLastWeek: 0, searchesLastWeek: 0, noResult: { ...r.noResult, figure: { value: null, why: 'no_data' }, numerator: 0, denominator: 0 } })) } },
      made: { state: 'ok', data: { exactFrom: null, weeks: WEEKS.map((w) => ({ ...w, made: zero, importedExact: 0, importedByDay: 0 })) } },
      cohorts: { state: 'ok', data: { rows: data(ADMIN.cohorts).rows.map((c) => ({ ...c, made: 0, supersededSince: 0, imported: 0, basis: null })) } },
      byKind: { state: 'ok', data: data(ADMIN.byKind).map((k) => ({ ...k, standing: 0 })) },
      questions: { state: 'ok', data: { ...data(ADMIN.questions), rows: [], total: 0 } },
    };
    draw(ok(fresh));
    expect(card('Lessons made by week').textContent).toContain('No import has named its lessons yet');
    expect(card('Lessons made by week').querySelector('[data-left-out]')!.textContent).toBe('No import was left out of these weeks.');
    expect(screen.getByText('No lesson made yet')).toBeInTheDocument();
    expect(screen.getByText('No lesson stands yet')).toBeInTheDocument();
    expect(screen.getByText('Every search found something')).toBeInTheDocument();
  });

  const failures: [KnowledgeHealthRead, string, string][] = [
    [{ state: 'failed', reason: 'The gateway refused the read' }, 'Knowledge health did not load', 'The gateway refused the read. Nothing on this page was read.'],
    [{ state: 'slow' }, 'Knowledge health is unavailable', `The read did not answer within ${KNOWLEDGE_HEALTH_BOUND_MS / 1000} seconds.`],
  ];
  for (const [r, title, detail] of failures) {
    it(`error: a ${r.state} read is the error state, with Retry asking the server again`, () => {
      const { container } = draw(r);
      expect(screen.getByRole('alert')).toHaveTextContent(title);
      expect(screen.getByRole('alert')).toHaveTextContent(detail);
      expect(container.querySelector('[data-figures]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(router.refresh).toHaveBeenCalledOnce();
    });
  }

  it('dates the masthead with the read\'s own cutoff, and nothing when there is no read', () => {
    const { unmount } = render(<KnowledgeHealthAsOf read={ok(ADMIN)} />);
    expect(screen.getByText(`As of ${formatDateTime(ADMIN.meta.asOf)}`)).toBeInTheDocument();
    unmount();
    const { container } = render(<KnowledgeHealthAsOf read={{ state: 'slow' }} />);
    expect(container.textContent).toBe('');
  });
});

describe('the Ask on the shelves', () => {
  it('sits in the head of the table of shelves with the assistant on, and is absent with it off', () => {
    const ask = vi.fn();
    const { unmount } = draw(ok(ADMIN), ask);
    const button = screen.getByRole('button', { name: /^Ask: / });
    const head = button.closest('[data-protagonist="Each shelf"]')!.querySelector('section, .card')!;
    expect(head.firstElementChild?.contains(button)).toBe(true);
    fireEvent.click(button);
    expect(ask).toHaveBeenCalledWith('What stands on each team\'s shelf, and how did each team\'s searches go last week?');
    unmount();
    const member = draw(ok(MEMBER_READ), ask);
    expect(screen.getByRole('button', { name: /^Ask: / }).getAttribute('aria-label')).toBe('Ask: How do my team\'s shelf and the shared shelf stand beside every shelf\'s totals?');
    member.unmount();
    draw(ok(ADMIN));
    expect(screen.queryByRole('button', { name: /^Ask: / })).toBeNull();
  });
});

describe('what the assistant is told', () => {
  const text = (h: KnowledgeHealth) => contextText(knowledgeHealthContext(ok(h)));

  it('carries the values the page draws, inside the budget', () => {
    const t = text(ADMIN);
    expect(t).toContain('- Lessons adopted: 142');
    expect(t).toContain('- Share with no result: 10.0%');
    expect(t).toContain('All shelves 142/15/122, 3/40/10.0%; atlas (your team) 11/1/2, 1/28/10.7%, too few; beacon');
    expect(t).toContain(`Imports are told exactly from the week of ${day(3)}`);
    expect(t).toContain(`Left out as imported: the week of ${day(1)} 96 by the day rule; the week of ${day(4)} 24 told exactly.`);
    expect(t).toContain(`"${QUESTIONS[0].question}" (atlas, 4 times)`);
    expect(t).toContain(`As of ${formatDateTime(ADMIN.meta.asOf)}`);
    // The superadmin's questions come last, and crowd out neither the cohorts nor the kinds (Phase 7's third re-review,
    // Platform P-1): every section is told, and nothing is dropped unnamed.
    expect(t).toContain('Standing lessons by kind: decision 42');
    expect(t).toContain('Lessons by the week made, imports included');
    expect(t).not.toContain('More is on the page than fits here');
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('names no other team to a member, asks no question, and says neither is in the read', () => {
    const t = text(MEMBER_READ);
    expect(NAMED.exec(t)?.[0]).toBeUndefined();
    for (const q of QUESTIONS) expect(t).not.toContain(q.question);
    expect(t).toContain('Your team\'s shelf 11/1/2, 1/28/10.7%, too few; The shared shelf 128/14/120');
    expect(t).toContain('no question a search that found nothing asked is in this read');
    expect(t).toContain(`${day(1)} 96 made · 96 imported, by day · 9 superseded since`);
    expect(t).toContain('Standing lessons by kind: decision 42');
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
  });

  it('holds its budget on a busy platform, 26 weeks and forty shelves, keeping the shelves and naming each section it leaves out', () => {
    const week = (i: number): Window => {
      const from = Date.UTC(2026, 3, 13) + i * 7 * 86_400_000;
      return { from: new Date(from).toISOString(), to: new Date(from + 7 * 86_400_000).toISOString(), observedFrom: null, observedThrough: null, complete: i < 25 };
    };
    const weeks = Array.from({ length: 26 }, (_, i) => week(i));
    const madeWeek = data(ADMIN.made).weeks[0];
    const searchWeek = data(ADMIN.searches).weeks[4];
    const cohort = data(ADMIN.cohorts).rows[1];
    const shelf = data(ADMIN.shelves).rows[1];
    const busy = (fleet: boolean): KnowledgeHealth => ({
      ...(fleet ? ADMIN : MEMBER_READ),
      shelves: { state: 'ok', data: { rows: fleet ? [...Array.from({ length: 40 }, (_, i) => ({ ...shelf, shelf: `a-long-team-slug-number-${i}` })), data(ADMIN.shelves).rows.at(-1)!] : data(MEMBER_READ.shelves).rows } },
      made: { state: 'ok', data: { exactFrom: weeks[20].from, weeks: weeks.map((window, i) => ({ ...madeWeek, window, made: { value: 1_000 + i, why: null }, importedExact: i % 5 ? 0 : 1_234, importedByDay: i % 3 ? 0 : 4_321 })) } },
      searches: { state: 'ok', data: { weeks: weeks.map((window) => ({ ...searchWeek, window })) } },
      cohorts: { state: 'ok', data: { rows: weeks.map((window) => ({ ...cohort, window, made: 5_555 })) } },
      questions: fleet ? { state: 'ok', data: { window: weeks[0], rows: Array.from({ length: 10 }, (_, i) => ({ question: `${'why does the nightly reindex never find the lesson we wrote '.repeat(3)}${i}`, shelf: `a-long-team-slug-number-${i}`, asked: 99, lastAskedAt: weeks[24].from })), total: 812 } } : null,
    });
    for (const fleet of [true, false]) {
      const c = knowledgeHealthContext(ok(busy(fleet)));
      const t = contextText(c);
      expect(t.length, fleet ? 'the superadmin' : 'a member').toBeLessThanOrEqual(CONTEXT_BUDGET);
      expect(t).toContain('Each shelf as its');
      expect(t).toContain('All shelves');
      expect(t).toContain('the last 8 weeks from the');
      expect(t).toContain('- Searches last week:');
      expect(t).not.toContain('More is on the page than fits here');
      for (const [told, title] of [['Standing lessons by kind:', 'Lessons by kind'], ['Lessons by the week made,', 'Lessons by the week made']]) {
        expect(t.includes(told) || (c.unknowns.at(-1)!.startsWith('On the page only') && c.unknowns.at(-1)!.includes(title)), title).toBe(true);
      }
    }
  });

  it('says which parts could not be read, and that nothing was read when nothing was', () => {
    expect(text({ ...ADMIN, byKind: { state: 'unavailable', reason: 'timeout' } })).toContain('The lessons by kind could not be read (timeout).');
    const slow = contextText(knowledgeHealthContext({ state: 'slow' }));
    expect(slow).toContain('Knowledge health is unavailable');
    expect(slow).not.toContain('Facts:');
  });
});

describe('view_knowledge_health and explore_knowledge_health', () => {
  it('answers the same response its page reads, with the page\'s context', async () => {
    answering(ME);
    const { context, data: answered } = await knowledgeHealthTool.read({});
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/knowledge');
    expect(answered).toEqual(ADMIN);
    expect(context).toEqual(knowledgeHealthContext(ok(answered as KnowledgeHealth)));
    expect(knowledgeHealthTool.name).toBe('knowledge_health');
    expect(knowledgeHealthTool.page).toBe('/platform/knowledge');
    expect(knowledgeHealthTool.needs).toBe(FEATURES['knowledge-health'].needs);
    expect(knowledgeHealthTool.input.safeParse({}).success).toBe(true);
  });

  it('answers a member the member\'s response, which names no other team', async () => {
    answering(MEMBER);
    const { context, data: answered } = await knowledgeHealthTool.read({});
    expect(answered).toEqual(MEMBER_READ);
    expect(NAMED.exec(contextText(context))?.[0]).toBeUndefined();
  });

  it('declares the platform\'s lessons and searches, each drill naming its collection\'s key', () => {
    const { sources } = knowledgeHealthTool.explore;
    expect(Object.fromEntries(Object.entries(sources).map(([k, s]) => [k, s.collection]))).toEqual({ lessons: 'platform_lessons', searches: 'platform_searches' });
    for (const s of Object.values(sources)) expect(s.drill.columns).toContain(PREPARED.find((r) => r.name === s.collection)!.key);
    const rights: ExploreRights = { readable: new Set(Object.values(sources).map((s) => s.collection)), hidden: () => [] };
    expect(JSON.stringify(z.toJSONSchema(exploreSchema(knowledgeHealthTool.explore, rights))).length).toBeLessThanOrEqual(6000);
  });

  /** One call of the prepared query as `who`, through the authorized reads, as the assistant's route runs it. */
  const explore = (who: Me, input: unknown) => {
    answering(who);
    const rights: ExploreRights = { readable: new Set(['platform_lessons', 'platform_searches']), hidden: () => [] };
    return runExplore(knowledgeHealthTool.explore, input, rights, { aggregate, read: readCollection, today: new Date().toISOString().slice(0, 10) }, knowledgeHealthTool.page);
  };
  const nothing = { source: 'searches', measures: ['nothing'], where: [{ field: 'found', op: 'eq', value: 'nothing' }], period: 'all', rows: 5 };

  it('drills the searches that found nothing to their questions for the superadmin', async () => {
    const { answer } = await explore(ME, nothing);
    expect(answer).toContain('- /platform/knowledge: question ');
    expect(QUESTIONS.some((q) => answer.includes(q.question))).toBe(true);
  });

  it('tells a member the counts and refuses them the questions', async () => {
    const counted = await explore(MEMBER, { ...nothing, rows: 0 });
    expect(counted.answer).toMatch(/Found nothing: \d/);
    await expect(explore(MEMBER, nothing)).rejects.toThrow('You do not have access to that.');
  });

  it('counts the lessons made outside the imports by shelf, a member\'s by what each shelf is', async () => {
    const asked = { source: 'lessons', measures: ['made'], by: 'shelf', period: 'all' };
    expect((await explore(ME, asked)).answer).toContain('zz-platform');
    const member = (await explore(MEMBER, asked)).answer;
    expect(member).toContain('your team\'s shelf');
    expect(member).toContain('the shared shelf');
    expect(NAMED.exec(member)?.[0]).toBeUndefined();
  });

  it('refuses a drill of the lessons with the sentence naming the page that counts them', async () => {
    await expect(explore(ME, { source: 'lessons', measures: ['lessons'], period: 'all', rows: 5 })).rejects.toThrow('Knowledge health (/platform/knowledge) counts them and lists none');
  });
});

describe('the page on the console\'s server', () => {
  it('is titled as its own page, for both roles', async () => {
    for (const who of [ME, MEMBER]) {
      answering(who);
      expect(await generateMetadata()).toEqual({ title: 'Knowledge health' });
    }
  });

  it('reads once, as the person, and hands the one read to the as-of line and the page', async () => {
    answering(MEMBER);
    const found: unknown[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      const props = node.props as Record<string, unknown>;
      if (props.read) found.push(props.read);
      Object.values(props).forEach(walk);
    };
    walk(await PlatformKnowledgePage());
    expect(found).toHaveLength(2);
    expect(found[0]).toBe(found[1]);
    expect(await found[0]).toEqual(ok(MEMBER_READ));
    expect(gateway.get.mock.calls.filter(([p]) => p === '/platform/knowledge')).toHaveLength(1);
  });
});

describe('the read on the server', () => {
  it('asks the gateway for the knowledge store\'s health and hands the whole of it on', async () => {
    gateway.get.mockResolvedValueOnce(ADMIN);
    expect(await readKnowledgeHealth()).toEqual(ok(ADMIN));
    expect(gateway.get).toHaveBeenLastCalledWith('/platform/knowledge');
  });

  it('is failed with the gateway\'s sentence when it refuses, and never rejects', async () => {
    gateway.get.mockRejectedValueOnce(new Error('could not read the knowledge store'));
    expect(await readKnowledgeHealth()).toEqual({ state: 'failed', reason: 'could not read the knowledge store' });
  });

  it('is slow once the bound has passed, however long the gateway takes', async () => {
    vi.useFakeTimers();
    gateway.get.mockReturnValueOnce(new Promise(() => {}));
    const pending = readKnowledgeHealth();
    let settled: KnowledgeHealthRead | null = null;
    void pending.then((r) => { settled = r; });
    await act(async () => { await vi.advanceTimersByTimeAsync(KNOWLEDGE_HEALTH_BOUND_MS - 1); });
    expect(settled).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(await pending).toEqual({ state: 'slow' });
  });
});
