import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the initiatives page shows are the gateway's: the list answers its rows already filtered and paged for the
 * active team, so the page draws each row's gates, state and next move as given, and asks the server again for a
 * filter or a page rather than narrowing what it holds.
 *
 * What it pins is the page's most derived cell, **Gates**, `${passed} of ${of}` as the row carries it, so a page that
 * counted anything itself cannot pass both rows; that the Team column is gone, since Work is the active team's; and the
 * addresses the page asks, which carry its filters and its page of ten.
 *
 * `cell()` reads the header row for a column's position, then that cell of the row carrying the needle, taking the
 * cell's FIRST child because a `DataTable` also draws the words a phone card uses.
 */
import type { InitiativeList, InitiativeRow } from '@/lib/work-shapes';
import { InitiativesView } from '@/views/pages/initiatives';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const WINDOW = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };

const ROWS: InitiativeRow[] = [
  { slug: '2026-09-28-search-relevance', flow: 'sdlc-flow', state: 'waiting', gates: { passed: 1, of: 2 },
    nextMove: { action: 'approve', stage: 'plan', document: 'plan.md', waitingOn: 'a person', why: 'plan.md is written and waits on approval' },
    lastTouched: '2026-10-01T00:00:00Z', opened: '2026-09-28T00:00:00Z', closed: null },
  { slug: '2026-09-22-payout-schedule', flow: 'ops', state: 'open', gates: { passed: 0, of: 1 },
    nextMove: { action: 'write', stage: 'intent', document: 'intent.md', waitingOn: 'the agent', why: 'the intent stage is under way' },
    lastTouched: '2026-09-30T00:00:00Z', opened: '2026-09-22T00:00:00Z', closed: null },
];

const LIST: InitiativeList = {
  meta: { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: WINDOW.from, to: '2026-10-15T00:00:00Z' }, scope: 'active-team', population: 'atlas', coverageFrom: null },
  tiles: { open: 2, waiting: 1, closed: { accepted: 3, delivered: 1, abandoned: 2 } },
  closures: { state: 'ok', data: [] },
  rows: ROWS, total: 23,
  summary: { state: 'ok', data: {
    total: 23, byState: { open: 1, waiting: 1, quiet: 15, accepted: 3, delivered: 1, abandoned: 2 },
    byFlow: [{ flow: 'sdlc-flow', count: 20 }, { flow: 'ops', count: 2 }, { flow: null, count: 1 }],
    touched: [], previous: { window: WINDOW, total: 21 },
  } },
  nextMoveState: 'ok',
};

let asked: URL[] = [];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://console.test');
    asked.push(url);
    const body = url.pathname.endsWith('/me') ? ME : LIST;
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The text of the row carrying `needle`, in the column whose header is `header`. */
function cell(needle: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(needle));
  if (column < 0 || !row) return `no ${header} column or no ${needle} row`;
  const td = [...row.querySelectorAll('td')][column];
  return (td?.firstElementChild ?? td)?.textContent?.trim() ?? '';
}

/** The list reads the page asked for, by their query strings, less the console's scope, which Work's list ignores. */
const listReads = () => asked.filter((u) => u.pathname.endsWith('/initiatives'))
  .map((u) => new URLSearchParams([...u.searchParams].filter(([k]) => k !== 'scope')));

beforeEach(() => {
  asked = [];
  window.history.replaceState(null, '', '/initiatives');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InitiativesView /></QueryClientProvider>);
}

describe('the figures on the initiatives page', () => {
  it('draws each row\'s gates, state and next move as the gateway answered them', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    expect(cell('2026-09-28-search-relevance', 'Gates')).toBe('1 of 2');
    expect(cell('2026-09-22-payout-schedule', 'Gates')).toBe('0 of 1');
    expect(cell('2026-09-28-search-relevance', 'State')).toBe('Waiting');
    expect(cell('2026-09-28-search-relevance', 'Flow position')).toBe('approve plan.md, waiting on a person');
    expect(document.body.textContent).toContain('23 initiatives');
  });

  it('has no Team column: Work is the active team\'s', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    expect([...document.querySelectorAll('th')].map((h) => h.textContent?.trim())).not.toContain('Team');
  });

  it('asks the server for its first page of ten, and for a filter rather than narrowing what it holds', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    const first = listReads()[0];
    expect(Object.fromEntries(first)).toEqual({ limit: '10', offset: '0' });
    expect(asked.some((u) => u.searchParams.get('waiting') === '1')).toBe(false);

    window.history.replaceState(null, '', '/initiatives?state=quiet&page=2');
    asked = [];
    mount();
    await waitFor(() => expect(listReads().length).toBeGreaterThan(0));
    expect(Object.fromEntries(listReads()[0])).toEqual({ state: 'quiet', limit: '10', offset: '10' });
  });

  it('pages through the server: the next page is another read', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Next page' })[0]);
    await waitFor(() => expect(listReads().some((p) => p.get('offset') === '10')).toBe(true));
  });
});
