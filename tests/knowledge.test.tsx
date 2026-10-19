import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Next's router as far as an address goes: `replace` moves it, which is what the page's own state is read from, and
 *  `refresh`, which asks the server for the page again, is counted. */
const nav = vi.hoisted(() => ({ refreshed: 0 }));
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace: (url: string) => window.history.replaceState(null, '', url), refresh: () => { nav.refreshed += 1; }, back() {}, forward() {}, prefetch() {} }),
}));

/**
 * What the Knowledge page draws, and in which order (Task I-108, spec version 8's Knowledge row): it leads with the
 * platform's ranked search, which runs when the person submits a question and never as they type; the results come in
 * the gateway's order with their shelf, and a lesson on the shared shelf opens its node page, marked shared. Then the four
 * tiles, the team's own questions that found nothing in the gateway's order, searches with results by week with a week
 * of no search drawn as no data, and the newest lessons with the shelf beside them. No line calls a result an answer.
 *
 * The summary is the console's server's read, handed to the page as the route hands it; every browser read is a real
 * read through `fetch`, answered here, and the address it asked for is recorded.
 */
import type { KnowledgeBody, SearchAnswer, SearchHit } from '@/lib/api-shapes';
import type { KnowledgeList, KnowledgeRow, KnowledgeSummary } from '@/lib/destination-shapes';
import type { PeriodFigure } from '@/lib/platform-shapes';
import type { ServerRead } from '@/views/knowledge-context';
import { KnowledgeView, SEARCH_TITLE } from '@/views/pages/knowledge';
import { KnowledgeLogView } from '@/views/pages/knowledge-log';
import { KnowledgeNodeView } from '@/views/pages/knowledge-node';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'member', mayRead: true, superadmin: false,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const week = (from: string, to: string, complete: boolean, found: number, of: number): PeriodFigure => ({
  window: { from, to, observedFrom: from, observedThrough: complete ? to : null, complete },
  // The gateway's own shape for a week with no search: no value, `no_data`, a zero denominator.
  figure: of ? { value: (100 * found) / of, why: null } : { value: null, why: 'no_data' },
  numerator: found, denominator: of,
});
const META = { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: '2026-09-21T00:00:00Z', to: '2026-10-15T00:00:00Z' }, scope: 'active-team' as const, population: 'atlas', coverageFrom: null };
const LAST = week('2026-10-05T00:00:00Z', '2026-10-12T00:00:00Z', true, 18, 24);

const SUMMARY: KnowledgeSummary = {
  meta: META,
  tiles: {
    standing: { value: 41, why: null, imported: 6 }, superseded: { value: 3, why: null },
    searches: { window: LAST.window, figure: { value: 24, why: null }, numerator: 24, denominator: null },
    noResult: { window: LAST.window, figure: { value: 6, why: null }, numerator: 6, denominator: 24 },
  },
  // Most asked first, as the gateway orders them; the second was asked more recently, so a page that re-sorted by
  // date would put it first.
  questions: { state: 'ok', data: { total: 2, rows: [
    { question: 'how do we rotate the signing key', asked: 3, lastAsked: '2026-10-01T00:00:00Z' },
    { question: 'who owns the crawler', asked: 1, lastAsked: '2026-10-11T00:00:00Z' },
  ] } },
  weeks: { state: 'ok', data: [
    week('2026-09-21T00:00:00Z', '2026-09-28T00:00:00Z', true, 5, 10),
    week('2026-09-28T00:00:00Z', '2026-10-05T00:00:00Z', true, 0, 0),
    LAST,
    week('2026-10-12T00:00:00Z', '2026-10-19T00:00:00Z', false, 2, 3),
  ] },
  newest: { state: 'ok', data: [{ team: 'atlas', path: 'nodes/0012-a-person-reads-a-snippet.md', title: 'A person reads a snippet before it ships', kind: 'process', createdAt: '2026-10-14T00:00:00Z', imported: false }] },
};
const READ: ServerRead<KnowledgeSummary> = { state: 'ok', data: SUMMARY, at: '2026-10-15T00:00:00Z' };

const shelfRow: KnowledgeRow = {
  key: 'atlas/nodes/0011-re-index-nightly.md', num: '0011', team: 'atlas', path: 'nodes/0011-re-index-nightly.md', type: 'decision', status: 'adopted',
  title: 'Re-index nightly, never on write', tags: null, updated: '2026-10-10T00:00:00Z', bytes: 900, excerpt: 'Re-index nightly.', evidence: null, cited_elsewhere: 0, superseded_by: null,
};
const LIST: KnowledgeList = { meta: META, total: 1, rows: [shelfRow], summary: { byKind: { decision: 1 }, standing: 1, superseded: 0 } };

const hit = (over: Partial<SearchHit>): SearchHit => ({
  kind: 'node', team: 'atlas', shelf: 'team', initiative: null, path: 'nodes/0004-rank-by-recency-first.md', title: 'Rank by recency first',
  type: 'decision', status: 'superseded', superseded_by: '0005', tags: [], evidence: [], cited_elsewhere: 0, flow: null, outcome: null,
  approved_by: null, approved_at: null, updated: null, excerpt: 'We **rank** by recency first.', score: 0.02, via: ['lexical'], ...over,
});
/** Three results, in the gateway's rank order: a team lesson, a shared lesson, a team document. */
const ANSWER: SearchAnswer = {
  team: 'atlas', query: 'rank by recency', ranked_total: 7, returned: 3, withheld: 4, superseded_in_results: 1, note: null, recall: null,
  results: [
    hit({}),
    hit({ team: 'zz-platform', shelf: 'platform', path: 'nodes/0001-search-the-shelf-first.md', title: 'Search the shelf before you write a lesson', status: 'adopted', superseded_by: null }),
    hit({ kind: 'document', initiative: '2026-09-28-search-relevance', path: 'spec.md', title: 'Spec: relevance that explains itself', status: 'approved', superseded_by: null }),
  ],
};

const asked: string[] = [];
beforeEach(() => {
  asked.length = 0;
  window.history.replaceState(null, '', '/knowledge');
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    const body = url.includes('/me') ? ME : url.includes('/search?') ? ANSWER : LIST;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as typeof fetch;
});

function mount(ui: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(<QueryClientProvider client={client}><Tooltip.Provider>{ui}</Tooltip.Provider></QueryClientProvider>);
}
const text = () => document.body.textContent ?? '';
const searches = () => asked.filter((u) => u.includes('/api/console/search?'));
const field = () => screen.getByRole('searchbox', { name: 'Question' });

async function search(q: string) {
  fireEvent.change(field(), { target: { value: q } });
  await act(async () => { fireEvent.submit(screen.getByRole('search')); });
  await waitFor(() => expect(document.querySelectorAll('[data-result]').length).toBe(ANSWER.results.length));
}

describe('the Knowledge page leads with the search', () => {
  it('opens on the search card, before the tiles', () => {
    mount(<KnowledgeView read={READ} />);
    const lead = screen.getByRole('heading', { name: SEARCH_TITLE });
    const tile = screen.getByText('Lessons adopted');
    expect(lead.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks nothing as the person types, and runs once on submit', async () => {
    mount(<KnowledgeView read={READ} />);
    fireEvent.change(field(), { target: { value: 'rank' } });
    fireEvent.change(field(), { target: { value: 'rank by' } });
    fireEvent.change(field(), { target: { value: 'rank by recency' } });
    await new Promise((r) => setTimeout(r, 400));
    expect(searches()).toEqual([]);
    await search('rank by recency');
    expect(searches()).toHaveLength(1);
    expect(searches()[0]).toContain('/api/console/search?q=rank+by+recency&limit=10');
  });

  it('draws the ranked results in the gateway\'s order, each with its shelf, and a shared lesson opens its node page', async () => {
    mount(<KnowledgeView read={READ} />);
    await search('rank by recency');
    const rows = [...document.querySelectorAll('[data-result]')] as HTMLElement[];
    expect(rows.map((r) => r.querySelector('.font-medium')?.textContent)).toEqual(ANSWER.results.map((h) => h.title));
    expect(rows.map((r) => r.getAttribute('data-result'))).toEqual(['team', 'platform', 'team']);
    expect(within(rows[0]).getByText('Your team')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Shared shelf')).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: ANSWER.results[1].title })).toHaveAttribute('href', '/knowledge/zz-platform/nodes/0001-search-the-shelf-first.md');
    expect(within(rows[2]).getByRole('link', { name: ANSWER.results[2].title })).toHaveAttribute('href', '/initiatives/atlas/2026-09-28-search-relevance/spec.md');
    expect(within(rows[0]).getByText('Superseded by node 0005')).toBeInTheDocument();
    expect(text()).toContain('3 of 7 ranked results');
  });

  it('says plainly when a search found nothing, with the search\'s own sentence', async () => {
    const empty: SearchAnswer = { ...ANSWER, query: 'zyzzyva', results: [], returned: 0, withheld: 0, ranked_total: 0, note: 'Nothing in team:atlas matches this question.', recall: 'no_relevant_match_in_searched_scope' };
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      return { ok: true, status: 200, json: async () => (url.includes('/search?') ? empty : url.includes('/me') ? ME : LIST) } as unknown as Response;
    }) as typeof fetch;
    mount(<KnowledgeView read={READ} />);
    fireEvent.change(field(), { target: { value: 'zyzzyva' } });
    await act(async () => { fireEvent.submit(screen.getByRole('search')); });
    await waitFor(() => expect(text()).toContain('Nothing found for "zyzzyva"'));
    expect(text()).toContain('Nothing in team:atlas matches this question.');
  });

  it('never calls a result an answer', async () => {
    mount(<KnowledgeView read={READ} />);
    await search('rank by recency');
    await waitFor(() => expect(text()).toContain(shelfRow.title));
    expect(text()).not.toMatch(/\banswer/i);
  });
});

describe('the rest of the Knowledge page', () => {
  it('draws the four tiles from the summary the server read', () => {
    mount(<KnowledgeView read={READ} />);
    for (const label of ['Lessons adopted', 'Superseded', 'Searches last week', 'Searches with no result']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(document.querySelector('[data-figures="read"]')).not.toBeNull();
  });

  it('lists the team\'s own questions that found nothing in the gateway\'s order, most asked first', () => {
    mount(<KnowledgeView read={READ} />);
    const order = SUMMARY.questions.state === 'ok' ? SUMMARY.questions.data.rows.map((x) => x.question) : [];
    const rows = [...document.querySelectorAll('tbody tr')].filter((tr) => order.some((q) => tr.textContent?.includes(q)));
    expect(rows.map((tr) => order.find((q) => tr.textContent?.includes(q)))).toEqual(order);
    expect(rows[0].textContent).toContain('3×');
  });

  it('draws searches with results by week, a week with no search as no data and never as 0%', async () => {
    mount(<KnowledgeView read={READ} />);
    // The chart loads after the page's first paint.
    const chart = (await screen.findByText('Share of the team\'s searches that found something, by week', { selector: 'caption' })).closest('table')!;
    const cells = [...chart.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td')?.textContent);
    expect(cells).toEqual(['50%', 'No searches', '75%', '67%']);
    expect(cells).not.toContain('0%');
    // The running week is drawn unfinished.
    expect(chart.querySelectorAll('tbody tr')[3].querySelector('th')?.textContent).toContain('so far');
    expect(text()).toContain('18 of 24 searches found something in the week of 5 Oct');
  });

  it('draws the newest lessons beside searches by week, with a link to the log, and the shelf under them', async () => {
    mount(<KnowledgeView read={READ} />);
    await waitFor(() => expect(text()).toContain(shelfRow.title));
    const newest = screen.getByRole('link', { name: 'A person reads a snippet before it ships' });
    const row = newest.closest('[data-split="1/2"]')!;
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole('heading', { name: 'Searches with results, by week' })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole('link', { name: /in the log/ })).toHaveAttribute('href', '/knowledge/log');
    const shelf = screen.getByText(shelfRow.title);
    expect(row.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.contains(shelf)).toBe(false);
  });

  it('says the shelf\'s figures did not load over a failed server read, with no figure and no mark of a read still coming', async () => {
    mount(<KnowledgeView read={{ state: 'failed', reason: 'the gateway could not reach its database' }} />);
    expect(text()).toContain('The shelf\'s figures did not load');
    expect(text()).toContain('the gateway could not reach its database');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    await waitFor(() => expect(text()).toContain(shelfRow.title));
  });

  it('asks the server for the summary again when a live hint says knowledge changed, and never on mount', async () => {
    nav.refreshed = 0;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mount(<KnowledgeView read={READ} />, client);
    await waitFor(() => expect(text()).toContain(shelfRow.title));
    expect(nav.refreshed).toBe(0);
    // What `ConsoleLive` does with a hint: every console read of the collection is read again.
    const knowledge = (key: readonly unknown[]) => key[0] === 'console' && String(key[1]).split('?')[0].split('/')[1] === 'knowledge';
    await act(async () => { await client.invalidateQueries({ predicate: (q) => knowledge(q.queryKey) }); });
    expect(nav.refreshed).toBe(1);
  });

  it('says a read slower than its bound did not answer in time', () => {
    mount(<KnowledgeView read={{ state: 'slow' }} />);
    expect(text()).toContain('It did not answer within 4.5 seconds.');
  });
});

describe('the page\'s log', () => {
  const entry = { ts: '2026-10-11T00:00:00Z', actor: 'noah.okafor@example.com', team: 'atlas', kind: 'knowledge.add' as const, node: '0003', recorded_title: 'Alert on the trend', superseded_by: null, node_title: 'Alert on the trend, not the count', node_status: 'adopted' };

  it('says whose log the server read, never the browser\'s scope switch', () => {
    mount(<KnowledgeLogView read={{ state: 'ok', data: { entries: [entry] }, at: '2026-10-15T00:00:00Z' }} />);
    expect(text()).toContain('Every lesson this team recorded or superseded, newest first.');
    expect(text()).toContain('Alert on the trend, not the count');
    expect(text()).toContain('11 Oct 2026');
  });

  it('says the entries did not load over a failed read, and never that nothing was recorded', () => {
    mount(<KnowledgeLogView read={{ state: 'failed', reason: 'the gateway could not reach its database' }} />);
    expect(text()).toContain('The entries did not load');
    expect(text()).toContain('the gateway could not reach its database');
    expect(text()).not.toContain('Nothing yet');
  });
});

describe('a lesson on the shared shelf', () => {
  const body: KnowledgeBody = {
    team: 'zz-platform', path: 'nodes/0001-search-the-shelf-first.md', type: 'process', status: 'adopted', title: 'Search the shelf before you write a lesson',
    tags: ['knowledge'], updated: '2026-09-01T00:00:00Z', body: 'Search the shelf first.', num: '1', evidence: null, cited_elsewhere: 2, superseded_by: null, evidence_in: null,
    related: [], multi_team: false, shelf: 'shared',
  };

  it('opens marked shared, with nothing that says read-only and nothing on the page that changes it', async () => {
    await act(async () => { mount(<KnowledgeNodeView read={{ state: 'ok', data: body, at: '2026-10-15T00:00:00Z' }} team="zz-platform" rel={body.path} />); });
    expect(text()).toContain('On the platform\'s shared shelf');
    expect(text()).not.toMatch(/read[- ]only/i);
    expect(screen.getAllByText('Shared').length).toBeGreaterThan(0);
    // Learned in two other teams' initiatives: counted, with no name and no link (reconciliation 81).
    expect(text()).toContain('2 initiatives of other teams');
    expect(document.querySelectorAll('a[href^="/initiatives/"]')).toHaveLength(0);
    // No assistant here, so no Ask; and no control of the page's own: a lesson is read, never edited, on this page. The
    // one button is the shell's, which opens the navigation.
    expect(screen.queryAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Open navigation']);
    expect(screen.queryAllByRole('textbox')).toEqual([]);
  });
});
