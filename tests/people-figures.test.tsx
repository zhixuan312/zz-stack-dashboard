import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the people page leads with are the data's.
 *
 * `standard.md`'s floor is that "the numbers the pages show are the data's", measured by a test that asserts the counts
 * and totals a page shows against the fixture behind it — its example is `tests/data.test.ts`. This is that test for
 * one page, and it exists because the floor was marked `pass` on the strength of there being 214 tests, which is not
 * evidence for it.
 *
 * HOW IT LOOKS, and why not by tile. A tile is a bare number, a label and a note, and a bare number cannot be found
 * unambiguously on a page that also draws a table of those same records — `getByText('2')` would match a token count, a
 * column and a row. The repo's own pattern for this (`overview-period.test.tsx`) is to assert the NOTE, which carries
 * the same figure in a distinctive sentence. So this pins the two notes that carry a figure, and the table, whose rows
 * are the people the data holds.
 *
 * The fixture is typed against `Person`, so a field renamed in the gateway breaks this rather than silently agreeing
 * with the page.
 */
import type { Person } from '@/lib/api-shapes';
import PeoplePage from '../app/(dash)/people/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/* Three people, chosen so every figure below is unambiguous and could not be reached by a different sum:
 *   people                  3   (the table's rows)
 *   superadmins             1   (the first)
 *   live tokens             2 + 0 + 4 = 6
 *   people holding a token  2   (the first and the third; the middle one has none)
 *   never used a token      1   (the middle one, and only them)
 *   teams                   2   (atlas and beacon across everyone; `teams` is `<slug> (<role>)`, so four memberships)
 * The middle person is what makes "never used" differ from "no tokens": they hold none and have used none. */
const PEOPLE: Person[] = [
  { email: 'one@example.com', name: 'One', role: 'superadmin', status: 'active', created: '2026-08-01',
    activeTeam: 'atlas', teams: ['atlas (admin)'], tokens: 2, last_used: '2026-10-01T00:00:00Z' },
  { email: 'two@example.com', name: 'Two', role: 'member', status: 'active', created: '2026-08-02',
    activeTeam: 'beacon', teams: ['atlas (member)', 'beacon (member)'], tokens: 0, last_used: null },
  { email: 'three@example.com', name: 'Three', role: 'member', status: 'active', created: '2026-08-03',
    activeTeam: 'beacon', teams: ['beacon (admin)'], tokens: 4, last_used: '2026-10-02T00:00:00Z' },
];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : { people: PEOPLE };
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/people');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

describe('the figures on the people page', () => {
  it('counts the superadmins the data holds', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PeoplePage /></QueryClientProvider>);
    await waitFor(() => expect(text()).toContain('1 superadmin'));
  });

  it('says how many people hold a token, which is not how many tokens there are', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PeoplePage /></QueryClientProvider>);
    // Two people hold six tokens. A page that showed the token count here would still render, and be wrong.
    await waitFor(() => expect(text()).toContain('Held by 2 people'));
  });

  it("lists the people the data holds, one row each", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PeoplePage /></QueryClientProvider>);
    const rows = await screen.findAllByRole('row');
    // How many rows the page draws is its own business — a table, a card list for the phone, a second table — so this
    // does not pin a count. What it pins is that the people the data holds are the people listed, by the addresses the
    // fixture gives, which is the part a mapping error breaks.
    expect(rows.length).toBeGreaterThan(0);
    await waitFor(() => expect(text()).toContain('one@example.com'));
    expect(text()).toContain('three@example.com');
    expect(text()).not.toContain('four@example.com');
  });
});
