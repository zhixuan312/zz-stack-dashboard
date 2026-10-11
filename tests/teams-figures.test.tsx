import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the teams page shows are the data's — the fifth page of `standard.md`'s floor, "the numbers the pages show
 * are the data's", and the FIRST of the table-led kind: this page has no tiles at all, so its figures are cell values
 * and the only honest way to pin one is by the column it sits under.
 *
 * That is what `cell()` below does: it reads the header row for a column's position and then takes that cell of the
 * named team's row. Asserting "the row for Atlas contains 7" would be satisfied by 7 landing in any column.
 *
 * The fixture gives every count a different value, so a page that mapped one column onto another's data would render
 * perfectly and fail here. Nothing pins how many rows the table draws — that is the page's business, and `people-figures`
 * learned that the hard way by pinning a row count and meeting a different one.
 */
import type { Team } from '@/lib/api-shapes';
import TeamsPage from '../app/(dash)/teams/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/* Each figure distinct, within its row and across the two: a column mapped onto another column's data cannot pass. */
const TEAMS: Team[] = [
  { slug: 'atlas', name: 'Atlas Research', status: 'active', created: '2026-08-01',
    members: 3, initiatives: 5, documents: 7, sources: 11, knowledge: 13 },
  { slug: 'beacon', name: 'Beacon Payments', status: 'archived', created: '2026-08-09',
    members: 17, initiatives: 19, documents: 23, sources: 29, knowledge: 31 },
];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : { teams: TEAMS };
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The text of `team`'s row, in the column whose header is `header`. */
function cell(team: string, header: string): string {
  const headers = [...document.querySelectorAll('th')].map((h) => h.textContent?.trim() ?? '');
  const column = headers.indexOf(header);
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent?.includes(team));
  if (column < 0 || !row) return `no ${header} column or no ${team} row`;
  // The cell's FIRST child, not its text: a `DataTable` renders the desktop value and the words a phone card uses for
  // the same cell ("7" and "7 documents"), one hidden by the stylesheet, and `textContent` reads both.
  const td = [...row.querySelectorAll('td')][column];
  return (td?.firstElementChild ?? td)?.textContent?.trim() ?? '';
}

beforeEach(() => {
  window.history.replaceState(null, '', '/teams');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TeamsPage /></QueryClientProvider>);
}

describe('the figures on the teams page', () => {
  it('shows each count in its own column, for the team the data names', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('Atlas Research'));
    expect(cell('Atlas Research', 'Documents')).toBe('7');
    expect(cell('Atlas Research', 'Knowledge')).toBe('13');
    // The other team, to show the columns are read per row and not once for the page.
    expect(cell('Beacon Payments', 'Documents')).toBe('23');
    expect(cell('Beacon Payments', 'Knowledge')).toBe('31');
  });

  it('counts the people a team has, not the memberships of everyone in it', async () => {
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('Atlas Research'));
    expect(cell('Atlas Research', 'People')).toBe('3');
    expect(cell('Beacon Payments', 'People')).toBe('17');
  });
});
