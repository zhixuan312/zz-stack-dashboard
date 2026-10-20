import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace: (url: string) => window.history.replaceState(null, '', url), refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));
vi.mock('@/lib/live', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/live')>()), useLive: () => 'live' }));

/**
 * Phase 7's review of the Work destinations, the findings of Home, Record, Knowledge, the knowledge log and a knowledge
 * node (Task I-152, AC-8.4, AC-2.8): each page drawn from the fake gateway's own answers, the ones `pnpm verify` and the
 * review's screenshots read, and each finding's cause looked for and not found.
 *
 * - F-13: Record's tile labels whole at a quarter-width tile, and its tick labels short enough not to touch.
 * - F-18, F-21: the log draws a supersession in no warning colour, and each date on one line.
 * - F-26: Knowledge's weekly chart shares its row with the newest lessons, not with ten questions it would stretch to.
 * - F-6: a node's superseded neighbour is marked, with a link to what replaced it.
 * - F-2, F-7, F-8: one measure, one name. "Lessons made" (the team's own work, an import's left out) on Home and Record,
 *   "Lessons adopted" (standing on the shelf, imports included) on Knowledge, each said against the other; words
 *   "added", never "net", since nothing a later revision removed is taken off; the added total said against the
 *   retained one; and a median of abandoned work said to be the span the record's Took column gives.
 *
 * Work F-15 (outcomes in categorical colours) is not here: the managed Column chart draws a stack's parts in the accent
 * or in status tones and takes no categorical slot, which the task reports rather than works around.
 */
import type { KnowledgeBody, KnowledgeLogEntry, Me } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { contextText } from '@/lib/shared-context';
import type { RecordRead } from '@/lib/work-shapes';
import { homeContext } from '@/views/home-context';
import { knowledgeContext } from '@/views/knowledge-context';
import { HomeView } from '@/views/pages/home';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { RecordView } from '@/views/pages/record';
import { recordContext, recordPath, tickOf, tilesOf, RECORD_DEFAULTS } from '@/views/record-context';
import { ME } from '../scripts/fake-gateway/people.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { KNOWLEDGE_LOG, SHELF, knowledgeList, knowledgeSummary, lesson, logOf } from '../scripts/fake-gateway/work-knowledge.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';

const TEAM = 'atlas';
const AT = '2026-10-19T12:00:00Z';
const answer = <T,>(a: [number, unknown]) => { expect(a[0]).toBe(200); return a[1] as T; };
const periods = (['quarter', 'year', 'all'] as const).map((p) => answer<RecordRead>(record(ME, new URLSearchParams({ period: p, limit: '10', offset: '0' }))));
const [, , ALL] = periods;
const HOME = homeOf(TEAM, ME.email);
const SUMMARY = answer<KnowledgeSummary>(knowledgeSummary(ME));
const LOG: KnowledgeLogEntry[] = KNOWLEDGE_LOG.filter((e) => e.team === TEAM);
const node = (num: string) => SHELF.find((n) => n.team === TEAM && n.num === num)!;
const LESSON = lesson(TEAM, node('0002').path, TEAM) as KnowledgeBody;

/** What a quarter-width tile shows of a label before it cuts it: about 21 characters at the narrowest four-up row. */
const TILE_LABEL = 21;
/** The longest tick the Trend chart sets without one running into the next: it keeps 92px between labels, and ends the last at the plot's edge. */
const TICK = 9;

beforeEach(() => {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const body: unknown = url.pathname.endsWith('/me') ? (ME satisfies Me) : answer<KnowledgeList>(knowledgeList(ME, url.searchParams));
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as typeof fetch;
});
afterEach(() => vi.unstubAllGlobals());

function mount(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
async function draw(path: string, ui: ReactElement) {
  window.history.replaceState(null, '', path);
  await act(async () => { mount(ui); });
}
const drawRecord = () => draw('/record', <RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: ALL, team: TEAM }} />);
const drawHome = () => draw('/', <HomeView read={{ state: 'ok', home: HOME, team: TEAM }} />);
const drawKnowledge = () => draw('/knowledge', <KnowledgeView read={{ state: 'ok', data: SUMMARY, at: AT }} />);
/** The row of cards the card a heading titles stands in, if it stands in one. */
const rowOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[data-split]') as HTMLElement | null;

describe('Record (Work F-13): labels whole and ticks apart', () => {
  it('writes every tile label to fit a quarter-width tile', async () => {
    await drawRecord();
    const labels = [...document.querySelectorAll('[data-split="tiles"] h2')].map((h) => h.textContent ?? '');
    expect(labels.length).toBeGreaterThanOrEqual(20);
    for (const label of labels) expect(label.length, label).toBeLessThanOrEqual(TILE_LABEL);
  });

  it('holds every slice\'s labels to it, in every period, where the hint says the rest', () => {
    for (const r of periods) {
      for (const t of Object.values(tilesOf(r)).flat()) {
        expect(t!.label.length, t!.label).toBeLessThanOrEqual(TILE_LABEL);
        expect(t!.hint.length, t!.label).toBeGreaterThan(t!.label.length);
      }
    }
  });

  it('writes each period\'s tick short enough that two never touch', () => {
    for (const r of periods) {
      const windows = r.cumulative.map((p) => p.window);
      const tick = tickOf(windows);
      for (const w of windows) expect(tick(w.from).length, tick(w.from)).toBeLessThanOrEqual(TICK);
    }
  });

  it('writes the month of a cutoff as every date writes it, never in lower case', async () => {
    await drawRecord();
    expect(text()).not.toMatch(/\b\d{1,2} (jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)\b/);
  });
});

describe('Record, Home and Knowledge (Work F-2, F-7, F-8): each measure named once', () => {
  it('calls the lessons the team\'s own work made "Lessons made" on Record, and the standing ones "Lessons adopted"', async () => {
    await drawRecord();
    const knowledge = document.querySelector('[data-slice="knowledge"]') as HTMLElement;
    expect(within(knowledge).getByRole('heading', { name: 'Lessons made' })).toBeInTheDocument();
    expect(within(knowledge).getByRole('heading', { name: 'Lessons made in all' })).toBeInTheDocument();
    expect(within(knowledge).getByRole('heading', { name: 'Lessons adopted, by kind' })).toBeInTheDocument();
    expect(within(knowledge).queryByText('Lessons adopted in all')).toBeNull();
    const made = tilesOf(ALL).knowledge!.find((t) => t.label === 'Lessons made')!;
    expect(made.hint).toMatch(/import's left out/);
    expect(made.hint).toMatch(/Lessons adopted are those standing/);
  });

  it('calls Home\'s lesson milestone what Record calls the same count', async () => {
    await drawHome();
    expect(text()).toContain('Lessons made');
    expect(text()).not.toContain('Lessons adopted');
    // Home's context is held to its budget, which cuts the milestones first: one with the lists empty keeps them.
    const t = contextText(homeContext({ state: 'ok', home: { ...HOME, openWork: { state: 'ok', data: { rows: [], quiet: 0, total: 0 } }, closedLastWeek: { state: 'ok', data: [] } }, team: TEAM }));
    expect(t).toMatch(/Next milestones: .*lessons made \d+ of \d+/);
    expect(t).not.toContain('lessons adopted');
  });

  it('says on Knowledge that its Lessons adopted stand on the shelf, imports included, and are not the lessons made', async () => {
    await drawKnowledge();
    expect(screen.getByRole('heading', { name: 'Lessons adopted' })).toBeInTheDocument();
    expect(text()).toMatch(/Standing now, \d+ imported/);
    const t = contextText(knowledgeContext({ summary: SUMMARY, filters: { q: '', kind: 'all' }, page: 1, updatedAt: AT, now: new Date(AT) }));
    expect(t).toMatch(/Lessons adopted: .*imports included; not the Lessons made of Home and Record/);
  });

  it('calls the words "added" wherever they are counted, never "net", since nothing removed is taken off', async () => {
    await drawRecord();
    expect(text()).not.toMatch(/net additions|net words/i);
    expect(text()).toMatch(/nothing taken off for what a later one removed/);
    document.body.innerHTML = '';
    await drawHome();
    expect(text()).not.toMatch(/net additions|net words/i);
    const t = contextText(homeContext({ state: 'ok', home: HOME, team: TEAM }));
    expect(t).not.toMatch(/net additions|net words/i);
  });

  it('says the running total of words added against the words retained it can pass', async () => {
    await drawRecord();
    expect(text()).toMatch(/Words added, a running total, by \w+: every word a revision added, .*so the total can pass the words retained/);
  });

  it('says a median of abandoned work is the span the record\'s Took column gives', () => {
    const t = tilesOf(ALL).work!.find((x) => x.key === 'medianAbandon')!;
    expect(t.hint).toMatch(/Took column/);
    expect(t.note).toMatch(/^The median, over /);
  });

  it('counts the skills the Runs list does not name, in the assistant\'s words as on the page', () => {
    const skills = ALL.agents.state === 'ok' ? ALL.agents.data.bySkill : [];
    expect(skills.length).toBeGreaterThan(4);
    // Record's context is held to its budget, which cuts its insights from the last: one with fewer before it keeps it.
    const lean: RecordRead = { ...ALL, firsts: { state: 'unavailable', reason: 'query_failed' }, documents: ALL.documents.state === 'ok' ? { state: 'ok', data: { ...ALL.documents.data, mostRewritten: [] } } : ALL.documents };
    const t = contextText(recordContext(lean, { filters: RECORD_DEFAULTS }));
    expect(t).toMatch(new RegExp(`and ${skills.length - 4} more skills?, \\d+ runs?`));
  });
});

describe('the knowledge log (Work F-18, F-21)', () => {
  beforeEach(async () => {
    await draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: logOf(LOG), at: AT }} />);
  });

  it('is the fixture this depends on: a supersession among the entries', () => {
    expect(LOG.some((e) => e.kind === 'knowledge.supersede')).toBe(true);
  });

  it('draws a supersession in no warning colour, its arrow saying what replaced what', () => {
    const row = screen.getAllByRole('row').find((r) => /Superseded/.test(r.textContent ?? ''))!;
    expect(row.querySelector('[class*="warning"]')).toBeNull();
    expect(row.textContent).toMatch(/node \d+ → \d+/);
  });

  it('sets every date on one line', () => {
    const times = [...document.querySelectorAll('tbody time')];
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) expect(t.className, t.textContent ?? '').toContain('whitespace-nowrap');
  });
});

describe('Knowledge (Work F-26): the weekly chart at its own height', () => {
  it('stands the chart beside the newest lessons, not beside the ten questions that found nothing', async () => {
    await drawKnowledge();
    const weeks = rowOf('Searches with results, by week');
    expect(weeks).not.toBeNull();
    expect(within(weeks!).getByRole('heading', { name: 'Newest lessons' })).toBeInTheDocument();
    expect(within(weeks!).queryByText('Questions that found nothing')).toBeNull();
    expect(rowOf('Questions that found nothing')).toBeNull();
    // And the chart takes the height the row gives its card, so the two end level.
    const chart = await screen.findByRole('figure', { name: /Share of the team's searches that found something/ });
    expect(chart.closest('[data-fills]')).not.toBeNull();
    expect(chart.className).toContain('flex-1');
  });
});

describe('a knowledge node (Work F-6): a superseded neighbour marked', () => {
  beforeEach(async () => {
    await draw(`/knowledge/${TEAM}/${LESSON.path}`, <KnowledgeNodeView read={{ state: 'ok', data: LESSON, at: AT }} team={TEAM} rel={LESSON.path} />);
  });

  it('is the fixture this depends on: a superseded neighbour, with its successor beside it', () => {
    const old = LESSON.related.find((n) => n.superseded_by);
    expect(old).toBeDefined();
    expect(LESSON.related.some((n) => n.num === old!.superseded_by)).toBe(true);
  });

  it('marks the superseded neighbour and links what replaced it; a current one is marked current', () => {
    const old = LESSON.related.find((n) => n.superseded_by)!;
    const next = LESSON.related.find((n) => n.num === old.superseded_by)!;
    const rows = screen.getAllByRole('row');
    const oldRow = rows.find((r) => r.textContent?.includes(old.title))!;
    expect(within(oldRow).getByText('Superseded')).toBeInTheDocument();
    expect(within(oldRow).getByRole('link', { name: `node ${next.num}` })).toHaveAttribute('href', `/knowledge/${TEAM}/${next.path}`);
    const nextRow = rows.find((r) => r.textContent?.includes(next.title) && r !== oldRow)!;
    expect(within(nextRow).queryByText('Superseded')).toBeNull();
    expect(within(nextRow).getByText('Adopted')).toBeInTheDocument();
  });
});
