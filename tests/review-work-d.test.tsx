import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, within } from '@testing-library/react';
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
 * Phase 7's re-review of the Work destinations (Task I-158, AC-8.4, AC-2.8): what it left below Strong on Home, Record,
 * Knowledge, the knowledge log and a knowledge node, each drawn from the fake gateway's own answers, the ones the
 * review's screenshots read, and each cause looked for and not found. A browser is what saw them, so where a finding is
 * a layout (a card stretched, a label cut) this reads what decides it; the screenshots of the build show it.
 *
 * - N-2: every milestone's bar measured from zero, made over the next round number.
 * - N-4: Record counts revisions, says so, and counts them as the document's own content history does.
 * - N-8: a week with no data reads one short whole word in its column.
 * - F-40, F-41, F-46, F-47, F-48: the Good points the re-review found left, each at its cause.
 * - F-56: the page's own starter question names the four figures on screen.
 *
 * Not here, because its cause is a managed file the task reports rather than edits: the assistant panel's own starter
 * question (ZZ Meridian #69). A count's axis is read in whole counts here; the managed chart still draws a gridline at
 * the half, which the task reports.
 */
import { SurfaceOverride } from '@/components/base/surface';
import type { KnowledgeBody, KnowledgeLogEntry, Me } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeSummary } from '@/lib/destination-shapes';
import { contextText } from '@/lib/shared-context';
import type { RecordRead } from '@/lib/work-shapes';
import { CONTEXT_BUDGET } from '@/views/context';
import { knowledgeNodeContext } from '@/views/knowledge-node-context';
import { MILESTONE } from '@/views/home-context';
import { HomeView } from '@/views/pages/home';
import { KnowledgeView } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';
import { RecordView } from '@/views/pages/record';
import { recordPath, tilesOf, RECORD_DEFAULTS } from '@/views/record-context';
import { ME, MEMBER } from '../scripts/fake-gateway/people.ts';
import { homeOf } from '../scripts/fake-gateway/work-home.ts';
import { KNOWLEDGE_LOG, SHELF, knowledgeList, knowledgeSummary, lesson } from '../scripts/fake-gateway/work-knowledge.ts';
import { record } from '../scripts/fake-gateway/work-record.ts';
import { documentDetail } from '../scripts/fake-gateway/work.ts';
import { knowledgeNodeHref } from '@/lib/knowledge-filters';

const TEAM = 'atlas';
const AT = '2026-10-19T12:00:00Z';
const answer = <T,>(a: [number, unknown]) => { expect(a[0]).toBe(200); return a[1] as T; };
const ALL = answer<RecordRead>(record(ME, new URLSearchParams({ period: 'all', limit: '10', offset: '0' })));
const HOME = homeOf(TEAM, ME.email);
const SUMMARY = answer<KnowledgeSummary>(knowledgeSummary(ME));
const LOG: KnowledgeLogEntry[] = KNOWLEDGE_LOG.filter((e) => e.team === TEAM);
const LESSON = lesson(TEAM, SHELF.find((n) => n.team === TEAM && n.num === '0002')!.path, TEAM) as KnowledgeBody;

beforeEach(() => {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    const body: unknown = url.pathname.endsWith('/me') ? (ME satisfies Me) : answer<KnowledgeList>(knowledgeList(ME, url.searchParams));
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as typeof fetch;
});
afterEach(() => vi.unstubAllGlobals());

/** The view as the shell holds it, with an assistant listening, so every Ask is drawn. */
function mount(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SurfaceOverride surface={{ ask: () => {} }}><Tooltip.Provider>{ui}</Tooltip.Provider></SurfaceOverride></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
async function draw(path: string, ui: ReactElement) {
  window.history.replaceState(null, '', path);
  await act(async () => { mount(ui); });
}
const drawRecord = () => draw('/record', <RecordView served={{ state: 'ok', path: recordPath(RECORD_DEFAULTS), data: ALL, team: TEAM }} />);
const drawHome = () => draw('/', <HomeView read={{ state: 'ok', home: HOME, team: TEAM }} />);
const drawKnowledge = () => draw('/knowledge', <KnowledgeView read={{ state: 'ok', data: SUMMARY, at: AT }} />);
const drawLog = () => draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: { entries: LOG }, at: AT }} />);
const drawNode = () => draw(`/knowledge/${TEAM}/${LESSON.path}`, <KnowledgeNodeView read={{ state: 'ok', data: LESSON, at: AT }} team={TEAM} rel={LESSON.path} />);
/** The card a heading titles. */
const cardOf = (title: string) => screen.getByRole('heading', { name: title }).closest('.card') as HTMLElement;
/** The row of cards the card a heading titles stands in, if it stands in one. */
const rowOf = (title: string) => screen.getByRole('heading', { name: title }).closest('[data-split]') as HTMLElement | null;

/** What each column with no data reads, chart by chart: the cell of its row in the chart's own table. */
function noDataWords(): { chart: string; words: string }[] {
  return [...document.querySelectorAll('figure')].flatMap((f) => {
    const columns = [...f.querySelectorAll('[data-column]')];
    const rows = [...f.querySelectorAll('table tbody tr')];
    return columns.flatMap((c, i) => (c.hasAttribute('data-no-data') ? [{ chart: f.getAttribute('aria-label') ?? '', words: rows[i]?.querySelector('td')?.textContent ?? '' }] : []));
  });
}

describe('Home (N-2, N-8, F-40)', () => {
  it('measures every milestone the same way, from zero: what is made over the next round number', async () => {
    await drawHome();
    const milestones = HOME.milestones.state === 'ok' ? HOME.milestones.data : [];
    expect(milestones.some((m) => m.last > 0)).toBe(true);
    const items = within(screen.getByRole('list', { name: 'Next milestones' })).getAllByRole('listitem').map((li) => li.textContent ?? '');
    for (const m of milestones) {
      const item = items.find((t) => t.startsWith(MILESTONE[m.count]))!;
      expect(item, m.count).toMatch(new RegExp(`${Math.round((m.value / m.next) * 100)}%$`));
    }
    expect(cardOf('Next milestones').textContent).toMatch(/from zero/);
  });

  it('writes a week with no words as one short whole word in its column', async () => {
    await drawHome();
    const empty = noDataWords().filter((x) => x.chart === 'Words added by week');
    expect(empty.length).toBeGreaterThan(0);
    for (const x of empty) expect(x.words).toMatch(/^None( so far)?$/);
  });

  it('counts the member\'s approvals on an axis of whole numbers, never 0.5', async () => {
    await draw('/', <HomeView read={{ state: 'ok', home: homeOf(TEAM, MEMBER.email), team: TEAM }} />);
    const ticks = [...screen.getByRole('figure', { name: 'Approvals in your name by week' }).querySelectorAll('[data-tick]')].map((t) => t.textContent ?? '');
    expect(ticks.filter(Boolean).length).toBeGreaterThan(1);
    for (const t of ticks) expect(t).toMatch(/^(\d[\d,]*)?$/);
  });

  it('lets Closed last week be its own height rather than stretch to the milestones beside it', async () => {
    await drawHome();
    expect(rowOf('Closed last week')!.className).toContain('items-start');
  });
});

describe('Record (N-4, N-8, F-41)', () => {
  const docs = ALL.documents.state === 'ok' ? ALL.documents.data : null;
  const firsts = ALL.firsts.state === 'ok' ? ALL.firsts.data : null;

  it('counts a document\'s revisions as its own page does: one a write, an approval\'s included', () => {
    expect(docs!.mostRewritten.length).toBeGreaterThan(0);
    for (const m of docs!.mostRewritten) expect(m.versions, `${m.initiative}/${m.path}`).toBe(documentDetail(TEAM, m.initiative, m.path)!.current_revision);
    const best = firsts!.bests.find((b) => b.key === 'most_versions')!;
    expect(best.value).toBe(docs!.mostRewritten[0].versions);
    expect(best.subject).toBe(`${docs!.mostRewritten[0].initiative}/${docs!.mostRewritten[0].path}`);
  });

  it('calls them revisions everywhere, and says what a document\'s page counts beside them', async () => {
    await drawRecord();
    expect(text()).not.toMatch(/Most versions|Versions written/);
    expect(tilesOf(ALL).firsts!.find((t) => t.key === 'most_versions')!.label).toBe('Most revisions');
    expect(cardOf('Most rewritten documents').textContent).toMatch(/revision.*document's own page/);
  });

  it('opens what it counts: each rewritten document and each skill\'s runs', async () => {
    await drawRecord();
    const m = docs!.mostRewritten[0];
    expect(within(cardOf('Most rewritten documents')).getByRole('link', { name: `${m.initiative}/${m.path}` })).toHaveAttribute('href', `/initiatives/${TEAM}/${m.initiative}/${m.path}`);
    const skill = ALL.agents.state === 'ok' ? ALL.agents.data.bySkill[0].skill : '';
    expect(within(cardOf('Runs by skill')).getByRole('link', { name: skill })).toHaveAttribute('href', `/runs?skill=${skill}`);
    // And says so where a still shows it: a row's link keeps the row's colour at rest.
    expect(within(cardOf('Runs by skill')).getByRole('link', { name: /is on Runs$/ })).toHaveAttribute('href', '/runs');
  });

  it('writes every week with no data as one short whole word in its column', async () => {
    await drawRecord();
    const empty = noDataWords();
    expect(new Set(empty.map((x) => x.chart))).toEqual(new Set(['Median hours to close', 'Words added', 'Searches with results']));
    for (const x of empty) expect(x.words, x.chart).toMatch(/^None( so far)?$/);
  });

  it('reads the hours axis in whole hours, never "0.0 h"', async () => {
    await drawRecord();
    const ticks = [...screen.getByRole('figure', { name: 'Median hours to close' }).querySelectorAll('[data-tick]')].map((t) => t.textContent);
    expect(ticks.length).toBeGreaterThan(1);
    for (const t of ticks) expect(t).toMatch(/^\d[\d,]* h$/);
  });

  it('sets the dated firsts across the card, earliest first, each label whole with its date', async () => {
    await drawRecord();
    const card = cardOf('Dated firsts');
    expect(card.querySelector('dt.w-32')).toBeNull();
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(firsts!.firsts.length);
    expect(items.map((li) => li.querySelector('time')!.getAttribute('dateTime'))).toEqual(firsts!.firsts.map((f) => f.at));
  });
});

describe('Knowledge (F-46, F-56)', () => {
  it('reads the search card\'s title whole at any width, and a placeholder short enough for a phone', async () => {
    await drawKnowledge();
    expect(screen.getByRole('heading', { name: 'Search what your team has learned' }).className).not.toContain('truncate');
    expect(screen.getByRole('searchbox', { name: 'Question' }).getAttribute('placeholder')!.length).toBeLessThanOrEqual(34);
  });

  it('titles the shelf\'s table', async () => {
    await drawKnowledge();
    expect(screen.getByRole('heading', { name: 'Lessons on your shelf' })).toBeInTheDocument();
  });

  it('asks, before any search, about the four figures on screen', async () => {
    await drawKnowledge();
    const t = SUMMARY.tiles;
    const ask = (await within(cardOf('Search what your team has learned')).findByRole('button', { name: /^Ask:/ })).getAttribute('aria-label')!;
    for (const n of [t.standing.value, t.superseded.value, t.searches.figure.value, t.noResult.figure.value]) expect(ask).toContain(String(n));
  });
});

describe('the knowledge log (F-47)', () => {
  it('names who wrote each entry by their address, as every other page does', async () => {
    await drawLog();
    expect(screen.getAllByRole('row').slice(1).some((r) => r.textContent?.includes('noah.okafor@example.com'))).toBe(true);
  });

  it('opens each entry\'s node where the node is still on the shelf, and nothing for one that is gone', async () => {
    await drawLog();
    const page = LOG.slice(0, 10);
    expect(page.some((e) => e.path !== null)).toBe(true);
    for (const e of page) {
      if (e.path !== null) expect(document.querySelector(`tbody a[href="${knowledgeNodeHref(e.team!, e.path)}"]`), e.node).not.toBeNull();
    }
    expect(document.querySelectorAll('tbody a[href^="/knowledge/"]')).toHaveLength(page.filter((e) => e.path !== null).length);
    cleanup();
    const gone = { ...LOG[0], node_title: null, node_status: null, path: null };
    await draw('/knowledge/log', <KnowledgeLogView read={{ state: 'ok', data: { entries: [gone] }, at: AT }} />);
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(document.querySelectorAll('tbody a[href^="/knowledge/"]')).toHaveLength(0);
  });

  it('keeps the node and who on the phone card', async () => {
    await drawLog();
    const row = screen.getAllByRole('row')[1];
    const phone = [...row.querySelectorAll('td')].map((td) => (td.querySelector(':scope > .hidden') ?? td).textContent ?? '').join(' ');
    expect(phone).toContain(`node ${LOG[0].node}`);
    expect(phone).toContain(LOG[0].actor);
  });
});

describe('a knowledge node (F-48)', () => {
  it('draws no Knowledge tab on a node page: the breadcrumb is the way back', async () => {
    await drawNode();
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull();
  });

  it('gives the lesson the page\'s width rather than stretch it to the facts beside it', async () => {
    await drawNode();
    expect(rowOf('The lesson')).toBeNull();
  });

  it('keeps an initiative it was learned in on one line, never broken at a hyphen', async () => {
    await drawNode();
    const learned = LESSON.evidence_in!.find((e) => e.team)!;
    expect(screen.getByRole('link', { name: learned.name }).className).toMatch(/\b(truncate|whitespace-nowrap)\b/);
  });
});

describe('a knowledge node\'s shared context (I-163): what an agent on the page is not told', () => {
  const arrival = { updatedAt: AT, now: new Date(AT) };
  const unknownsOf = (b: KnowledgeBody) => knowledgeNodeContext(b, arrival).unknowns;

  it('names what it leaves out even when the lesson and its citations are both there, as both people read node 0002', () => {
    for (const reader of [ME, MEMBER]) {
      const body = lesson(TEAM, LESSON.path, reader.activeTeam) as KnowledgeBody;
      expect(body.body.trim().length).toBeGreaterThan(0);
      expect(body.evidence_in?.length).toBeGreaterThan(0);
      const unknowns = unknownsOf(body);
      expect(unknowns.join(' '), reader.email).toMatch(/A citation names an initiative, not the document or decision/);
      expect(unknowns.join(' ')).toMatch(/Who recorded the lesson is not on this page/);
      expect(unknowns).not.toContain('The node names no initiative it was learned in.');
      const t = contextText(knowledgeNodeContext(body, arrival));
      expect(t).toContain('Unknown:');
      expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    }
  });

  it('says a superseding node\'s text and the lesson past what it carries are on the page, not in the context', () => {
    const old = { ...LESSON, superseded_by: '0005', body: `${'A long lesson. '.repeat(120)}` };
    const unknowns = unknownsOf(old).join(' ');
    expect(unknowns).toMatch(/The text of node 0005, which replaced it, is on its own page/);
    expect(unknowns).toMatch(/The lesson's last [\d,]+ characters are on the page/);
    const t = contextText(knowledgeNodeContext(old, arrival));
    expect(t.length).toBeLessThanOrEqual(CONTEXT_BUDGET);
    expect(t).toContain('Unknown:');
  });

  it('keeps the line for a node that names no initiative', () => {
    expect(unknownsOf({ ...LESSON, evidence_in: null, evidence: null, cited_elsewhere: 0 })).toContain('The node names no initiative it was learned in.');
  });
});
