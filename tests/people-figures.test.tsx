import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The figures People leads with are the data's.
 *
 * `standard.md`'s floor is that "the numbers the pages show are the data's", measured by a test that asserts the counts
 * and totals a page shows against the fixture behind it. This is that test for People: each tile is the gateway's own
 * figure, never one the page counted over the rows it holds, and each row's passkeys and last sign-in are that person's.
 *
 * The fixture is typed against `People`, so a field renamed in the gateway breaks this rather than silently agreeing
 * with the page. Its tiles are chosen so no tile could be read off the three rows: the page holds a page of a larger
 * population, and a tile counted over the page would be smaller.
 */
import type { People } from '@/lib/fleet-shapes';
import { PlatformPeopleView } from '@/views/pages/platform-people';
import { NO_SIGN_IN } from '@/views/people-context';
import { PEOPLE_DEFAULTS, peoplePath } from '@/views/people-filter';

const WEEK = { from: '2026-10-05T00:00:00Z', to: '2026-10-12T00:00:00Z', observedFrom: '2026-10-05T00:00:00Z', observedThrough: '2026-10-12T00:00:00Z', complete: true };
const DATA: People = {
  meta: { asOf: '2026-10-14T09:00:00Z', timezone: 'Pacific/Auckland', period: { from: '2026-06-01T00:00:00Z', to: '2026-10-14T09:00:00Z' }, scope: 'platform-admin', population: 'people, their passkeys and their recorded console sign-ins', coverageFrom: '2026-06-01T00:00:00Z' },
  tiles: { people: 23, withPasskey: 17, neverSignedIn: 5, signInsLastWeek: { window: WEEK, figure: { value: 41, why: null }, numerator: 41, denominator: null } },
  people: [
    { email: 'one@example.com', name: 'One', role: 'superadmin', created: '2026-08-01', teams: ['atlas (admin)'], passkeys: 2, lastSignIn: '2026-10-13T08:00:00Z', state: 'active' },
    { email: 'two@example.com', name: 'Two', role: 'member', created: '2026-08-02', teams: ['atlas (member)', 'beacon (member)'], passkeys: 0, lastSignIn: null, state: 'active' },
    { email: 'three@example.com', name: '', role: 'member', created: '2026-08-03', teams: [], passkeys: 1, lastSignIn: '2026-09-02T00:00:00Z', state: 'deactivated' },
  ],
  total: 23,
};

const row = (text: string) => screen.getAllByRole('row').find((r) => r.textContent?.includes(text))!;

beforeEach(() => {
  window.history.replaceState(null, '', '/platform/people');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

function draw() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Tooltip.Provider><PlatformPeopleView served={{ state: 'ok', path: peoplePath(PEOPLE_DEFAULTS), data: DATA }} /></Tooltip.Provider></QueryClientProvider>);
}

describe('the figures on People', () => {
  it('draws each tile as the gateway counted it, over everybody and not over the page it holds', () => {
    draw();
    expect([...document.querySelectorAll('[data-value]')].map((v) => v.textContent)).toEqual(['23', '17', '5', '41']);
    expect(screen.getByText('23 people')).toBeInTheDocument();
  });

  it('draws each person\'s own passkeys, last sign-in and state, and names a person with no name by their address', () => {
    draw();
    expect(within(row('one@example.com')).getByText('2')).toBeInTheDocument();
    expect(row('two@example.com').textContent).toContain(NO_SIGN_IN);
    expect(row('two@example.com').textContent).toContain('atlas (member), beacon (member)');
    expect(row('three@example.com').textContent).toContain('Deactivated');
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
    expect([...document.querySelectorAll('tbody tr')].filter((r) => r.textContent?.includes(NO_SIGN_IN))).toHaveLength(1);
  });
});
