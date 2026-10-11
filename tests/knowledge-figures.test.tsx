import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The figures the knowledge page leads with are the data's — the second page of `standard.md`'s floor, "the numbers the
 * pages show are the data's", whose first page is `tests/people-figures.test.tsx`.
 *
 * What it pins: the date the "Last recorded" tile leads with, which is the NEWEST node's — the one figure on this page
 * that cannot be reached by counting the wrong thing — and the nodes the table lists, by the titles the fixture gives.
 *
 * The date is computed here with the page's own `formatDate` rather than written out, so this asserts the CHOICE of
 * node (the newest) and not the spelling of a month. The tile's value is a relative time ("2 days ago") and is
 * deliberately not asserted: it moves with the clock, and a test that pins it would fail for a reason that is not the
 * data.
 */
import type { KnowledgeNode } from '@/lib/api-shapes';
import { formatDate } from '@/lib/format-date';
import KnowledgePage from '../app/(dash)/knowledge/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/* Three nodes, and the newest is deliberately not the first: a page that showed the first node's date, or the last one
 * it happened to read, would show a different day. */
const NODES: KnowledgeNode[] = [
  { key: 'atlas/nodes/0001-oldest', num: '0001', team: 'atlas', path: 'nodes/0001-oldest', type: 'knowledge',
    status: 'adopted', title: 'Oldest lesson', tags: ['search'], updated: '2026-08-01T00:00:00Z', bytes: 900,
    excerpt: 'The oldest of the three.', evidence: null, superseded_by: null },
  { key: 'atlas/nodes/0003-newest', num: '0003', team: 'atlas', path: 'nodes/0003-newest', type: 'knowledge',
    status: 'adopted', title: 'Newest lesson', tags: null, updated: '2026-10-02T00:00:00Z', bytes: 1200,
    excerpt: 'The most recent of the three.', evidence: null, superseded_by: null },
  { key: 'atlas/nodes/0002-middle', num: '0002', team: 'atlas', path: 'nodes/0002-middle', type: 'knowledge',
    status: 'superseded', title: 'Superseded lesson', tags: ['legacy'], updated: '2026-09-14T00:00:00Z', bytes: 700,
    excerpt: 'Replaced, still readable.', evidence: null, superseded_by: 'atlas/nodes/0003-newest' },
];

const newest = NODES.reduce((a, b) => (b.updated > a.updated ? b : a));

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : { nodes: NODES };
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/knowledge');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

describe('the figures on the knowledge page', () => {
  it("dates the shelf from its newest node, not from the first one read", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><KnowledgePage /></QueryClientProvider>);
    await waitFor(() => expect(text()).toContain('Last recorded'));
    expect(text()).toContain(formatDate(newest.updated));
    // The other two are on the page as rows, so their dates being absent from the tile is a choice and not an accident.
    expect(newest.title).toBe('Newest lesson');
  });

  it('lists the nodes the data holds, superseded ones included', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><KnowledgePage /></QueryClientProvider>);
    await waitFor(() => expect(text()).toContain('Newest lesson'));
    expect(text()).toContain('Oldest lesson');
    // Superseded is a status, not a deletion: `live.md` and the store both keep it readable.
    expect(text()).toContain('Superseded lesson');
  });
});
