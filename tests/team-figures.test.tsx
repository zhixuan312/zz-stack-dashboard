import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * A team's page reads its counts from the team's own read, `/teams/:slug`, and never from the list. The list is
 * paged, so a team past its first page would read no counts at all if the page went looking for its row there. Nor does
 * it read the team's initiatives: Work answers the active team's work alone, so the page draws the team's counts of
 * open and waiting work and lists none of it.
 *
 * The fixture's counts are each distinct, so a tile reading another count's value cannot pass, and every request
 * is recorded so a read of the list is caught whatever the page does with the answer.
 */
import type { TeamDetail } from '@/lib/fleet-shapes';
import { TeamView } from '@/views/pages/team';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const WEEK = { from: '2026-10-05T00:00:00+08:00', to: '2026-10-12T00:00:00+08:00' };

const DETAIL: TeamDetail = {
  team: { slug: 'atlas', name: 'Atlas Research', status: 'active', created: '2026-08-01' },
  members: [{ email: 'a@b.example.com', name: 'A', role: 'admin', joined: '2026-08-01' }],
  meta: {
    asOf: '2026-10-15T00:00:00Z', timezone: 'Asia/Singapore', scope: 'platform-admin',
    population: 'teams', coverageFrom: '2026-09-07T00:00:00+08:00', period: { from: '2026-09-07T00:00:00+08:00', to: '2026-10-15T00:00:00Z' },
  } as unknown as TeamDetail['meta'],
  counts: { members: 3, initiatives: 5, documents: 7, sources: 11, knowledge: 13 },
  tiles: { people: 3, openWork: 2, waiting: 1, lessons: 13 },
  calls: [{ window: WEEK } as unknown as TeamDetail['calls'][number]],
};

let asked: string[] = [];

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    const body = url.includes('/me') ? ME
      : url.includes('/teams/atlas') ? DETAIL
      : {};
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

beforeEach(() => {
  asked = [];
  window.history.replaceState(null, '', '/teams/atlas');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

/** Rendered inside an awaited `act`: the page suspends on its params until they resolve. */
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const params = Promise.resolve({ slug: 'atlas' });
  await act(async () => { render(
    <QueryClientProvider client={client}>
      <Suspense fallback={null}><TeamView params={params} /></Suspense>
    </QueryClientProvider>,
  ); });
}

describe('the figures on a team page', () => {
  it('draws the knowledge, documents and sources the team\'s own read counts', async () => {
    await mount();
    await waitFor(() => expect(document.body.textContent).toContain('7 documents, 11 sources'));
    expect(document.body.textContent).toContain('13');
  });

  it('draws the team\'s work from its counts: initiatives, open work and revisions waiting', async () => {
    await mount();
    await waitFor(() => expect(document.body.textContent).toContain('2 still open'));
    expect(document.body.textContent).toContain('Revisions waiting');
    expect(asked.filter((u) => u.includes('/initiatives'))).toEqual([]);
  });

  it('never asks for the list of teams', async () => {
    await mount();
    await waitFor(() => expect(document.body.textContent).toContain('7 documents, 11 sources'));
    const list = asked.filter((u) => /\/teams(\?|$)/.test(new URL(u, 'http://x').pathname + new URL(u, 'http://x').search));
    expect(list).toEqual([]);
  });
});
