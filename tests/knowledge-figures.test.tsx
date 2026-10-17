import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the knowledge page leads with are the data's — the second page of `standard.md`'s floor, "the numbers the
 * pages show are the data's", whose first page is `tests/people-figures.test.tsx`.
 *
 * What it pins: the four tiles are the summary's own figures, as the console's server read it and handed it to the page,
 * each a different number so one shown in another's place fails; a figure nobody read is a dash and never a zero; and
 * the lessons the shelf lists are the page the gateway answered, superseded ones included, read from the route at the
 * page's own kind rather than filtered in the browser.
 */
import type { KnowledgeList, KnowledgeRow, KnowledgeSummary } from '@/lib/destination-shapes';
import type { ServerRead } from '@/views/knowledge-context';
import { KnowledgeView } from '@/views/pages/knowledge';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };
const META = { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' }, scope: 'active-team' as const, population: 'atlas', coverageFrom: null };

/* Every tile a different number, and none of them the number of rows. */
const SUMMARY: KnowledgeSummary = {
  meta: META,
  tiles: {
    standing: { value: 41, why: null, imported: 6 }, superseded: { value: 3, why: null },
    searches: { window: WINDOW, figure: { value: 27, why: null }, numerator: 27, denominator: null },
    noResult: { window: WINDOW, figure: { value: 5, why: null }, numerator: 5, denominator: 27 },
  },
  questions: { state: 'ok', data: { rows: [{ question: 'how do we rotate the signing key', asked: 3, lastAsked: '2026-10-10T00:00:00Z' }], total: 1 } },
  weeks: { state: 'ok', data: [] },
  newest: { state: 'ok', data: [] },
};

const row = (num: string, title: string, status: string): KnowledgeRow => ({
  key: `atlas/nodes/${num}`, num, team: 'atlas', path: `nodes/${num}.md`, type: 'decision', status, title, tags: null,
  updated: '2026-10-01T00:00:00Z', bytes: 900, excerpt: `${title}.`, evidence: null, superseded_by: null,
});
const LIST: KnowledgeList = {
  meta: META, total: 44,
  rows: [row('0003', 'Most recent lesson', 'adopted'), row('0001', 'Oldest lesson', 'adopted'), row('0002', 'Superseded lesson', 'superseded')],
  summary: { byKind: { decision: 44 }, standing: 41, superseded: 3 },
};

const asked: string[] = [];
function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    // The summary is the server's read, handed to the page: the browser never asks for it.
    const body = url.includes('/me') ? ME : LIST;
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}
const text = () => document.body.textContent ?? '';

beforeEach(() => {
  asked.length = 0;
  window.history.replaceState(null, '', '/knowledge?kind=decision');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

const READ: ServerRead<KnowledgeSummary> = { state: 'ok', data: SUMMARY, at: '2026-10-15T00:00:00Z' };

function mount(read: ServerRead<KnowledgeSummary> = READ) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tooltip.Provider><KnowledgeView read={read} /></Tooltip.Provider></QueryClientProvider>);
}

describe('the figures on the knowledge page', () => {
  it('draws each tile from its own figure in the summary the server read', async () => {
    mount();
    expect(figure('Lessons adopted')).toBe('41');
    expect(figure('Superseded')).toBe('3');
    expect(figure('Searches last week')).toBe('27');
    expect(figure('Searches with no result')).toBe('5');
    expect(text()).toContain('6 imported');
    expect(text()).toContain('Of 27 last week');
    expect(asked.some((u) => u.includes('/knowledge/summary'))).toBe(false);
  });

  it('draws a figure nobody read as a dash, and says a week whose searches were not counted was not measured', () => {
    const unread = { ...SUMMARY, tiles: { ...SUMMARY.tiles, superseded: { value: null, why: 'unavailable' as const }, noResult: { ...SUMMARY.tiles.noResult, figure: { value: null, why: 'no_data' as const }, denominator: null } } };
    mount({ state: 'ok', data: unread, at: READ.state === 'ok' ? READ.at : '' });
    expect(figure('Superseded')).toBe('—');
    expect(figure('Searches with no result')).toBe('—');
    expect(text()).toContain('Not measured last week');
    expect(text()).not.toContain('Of 0 last week');
  });

  it('lists the page the route answered, superseded lessons included, and asks the route for its kind', async () => {
    mount();
    await waitFor(() => expect(text()).toContain('Most recent lesson'));
    expect(text()).toContain('Oldest lesson');
    // Superseded is a status, not a deletion: the store keeps it readable.
    expect(text()).toContain('Superseded lesson');
    expect(text()).toContain('44 lessons on the shelf');
    expect(asked.some((u) => u.includes('/knowledge?kind=decision&limit=10&offset=0'))).toBe(true);
  });
});
