import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the initiatives page shows are the data's — the seventh page of `standard.md`'s floor, and the third of the
 * table-led kind.
 *
 * What it pins is the page's most derived cell: **Gates**. It is not a count of the gates the data carries but
 * `${passed} of ${own}`, where `own` leaves out the platform's own `handover` step — that one is written after the
 * close, so a question about an open initiative must not count it. So a fixture with a handover gate makes the cell say
 * "1 of 2" where a page counting every gate would say "1 of 3", and both render perfectly.
 *
 * `cell()` is the teams page's, unchanged: read the header row for a column's position, then that cell of the row
 * carrying the needle, taking the cell's FIRST child because a `DataTable` also draws the words a phone card uses.
 */
import type { Initiative } from '@/lib/api-shapes';
import { InitiativesView } from '@/views/pages/initiatives';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const step = (name: string, current: boolean) => ({ name, what: `The ${name} step`, produces: `${name}.md`, state: 'done' as const, current });

/* Two initiatives whose gate fractions differ in both numbers, so a page that counted every gate, or counted the same
 * gate twice, cannot pass both rows. `handover` is one of atlas's three gates and counts for neither half of the cell. */
const INITIATIVES: Initiative[] = [
  { team: 'atlas', slug: '2026-09-28-search-relevance', flow: 'sdlc', documents: 4, approvals: 2,
    updated: '2026-10-01T00:00:00Z', stakeholder: 'Maya', at: 3, of: 7, stage: 'plan',
    steps: [step('intent', false), step('spec', true)], gates: [
      { name: 'spec', passed: true, written: true, after: 1 },
      { name: 'plan', passed: false, written: true, after: 2 },
      { name: 'handover', role: 'handover', passed: false, written: false, after: 3 },
    ], accepted: false, complete: false, closed: false, outcome: null, correction: null },
  { team: 'beacon', slug: '2026-09-22-payout-schedule', flow: 'ops', documents: 2, approvals: 0,
    updated: '2026-09-30T00:00:00Z', stakeholder: null, at: 1, of: 5, stage: 'intent',
    steps: [step('intent', true)], gates: [
      { name: 'intent', passed: false, written: false, after: 1 },
    ], accepted: false, complete: false, closed: false, outcome: null, correction: null },
];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/me')
      ? ME
      : url.includes('waiting=1')
        ? { waiting: [] }
        : { initiatives: INITIATIVES };
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

beforeEach(() => {
  window.history.replaceState(null, '', '/initiatives');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InitiativesView /></QueryClientProvider>);
}

describe('the figures on the initiatives page', () => {
  it('counts the gates an open initiative is judged on, leaving the handover out of both halves', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    // Three gates in the data, one of them the platform's handover: one passed of two that count.
    expect(cell('2026-09-28-search-relevance', 'Gates')).toBe('1 of 2');
    // One gate, none passed: a page that carried the other row's figures would say "1 of 3".
    expect(cell('2026-09-22-payout-schedule', 'Gates')).toBe('0 of 1');
  });

  it('names each initiative in its own team', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('2026-09-28-search-relevance'));
    expect(cell('2026-09-28-search-relevance', 'Team')).toBe('atlas');
    expect(cell('2026-09-22-payout-schedule', 'Team')).toBe('beacon');
  });
});
