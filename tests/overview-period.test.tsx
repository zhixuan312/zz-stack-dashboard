import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * THE OVERVIEW PAGE ACTUALLY RENDERS, against the response shape the gateway actually
 * sends.
 *
 * This exists because it did not. `daily`/`day` were renamed to `trend`/`bucket` in the
 * gateway and deployed ahead of the console that reads them, so the live page called
 * `.map` on a field that no longer existed and the route error boundary swallowed the
 * whole frame — the period picker with it, which is how "the chart is wrong" became "I
 * can't toggle time anymore". Nothing in the suite rendered this page, so nothing could
 * have caught a field rename.
 *
 * It asserts the two things a shape mismatch breaks first: that the page renders at all,
 * and that the period reaches the request as a parameter rather than being dropped.
 *
 * Mounted inside a real `PeriodProvider` rather than against a mocked router, because the
 * provider IS the mechanism now — mocking the thing under test is how the previous version
 * of this passed while the live control did nothing.
 */
// `@` aliases src/, and the page lives under app/ — relative, so no alias is invented
// for one test file.
import { PeriodProvider } from '@/components/PeriodProvider';
import OverviewPage from '../app/(dash)/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'team-one', role: 'admin' }], activeTeam: 'team-one',
};

// The gateway's real shape, hour-grained — the one the live page choked on.
const OVERVIEW = {
  counts: {
    teams: 1, activeTeams: 1, people: 11, superadmins: 1, documents: 84,
    initiatives: 6, events: 8566, failures: 1761, unattributedEvents: 0,
  },
  grain: 'hour',
  trend: [
    { bucket: '2026-09-09T04:00:00Z', events: 320, failures: 9 },
    { bucket: '2026-09-09T05:00:00Z', events: 411, failures: 12 },
  ],
  eventKinds: [{ kind: 'tool_call', n: 8551, failed: 1761 }],
  refusals: [{ block: 'casebox', tool: 'casebox:get_workflows', n: 1703, refusal: 'MCP error' }],
};

const urls: string[] = [];
function mockFetch() {
  return vi.fn(async (url: string) => {
    urls.push(url);
    const body = url.includes('/me') ? ME : OVERVIEW;
    return { ok: true, json: async () => body } as unknown as Response;
  });
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <OverviewPage />
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  urls.length = 0;
  window.history.replaceState(null, '', '/');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

describe('the overview page', () => {
  it('renders the gateway response instead of throwing on it', async () => {
    mount();
    // A tile's value proves the counts were read; the panel title proves `grain` was.
    // `1,761` is the Failing calls tile — the one number on this page somebody acts on.
    await waitFor(() => expect(screen.getByText('1,761')).toBeInTheDocument());
    expect(screen.getByText('Events per hour')).toBeInTheDocument();
  });

  it('asks for all time by default, with no period parameter at all', async () => {
    mount();
    await waitFor(() => expect(urls.some((u) => u.includes('/overview'))).toBe(true));
    const overview = urls.find((u) => u.includes('/overview'))!;
    expect(overview).not.toContain('period=');
  });

  it('carries the period from the address bar into the request', async () => {
    // A shared link is the case: somebody sends `/?period=1d` and the page it opens must
    // be the window they were looking at, not the default.
    window.history.replaceState(null, '', '/?period=1d');
    mount();
    await waitFor(() => expect(urls.some((u) => u.includes('period=1d'))).toBe(true));
  });

  it('titles the panel in whatever grain came back, not a hardcoded one', async () => {
    // A day-grained response must not still say "per hour" — the title is data, not a
    // constant, and this is the assertion that keeps it that way.
    const daily = { ...OVERVIEW, grain: 'day',
      trend: [{ bucket: '2026-09-08T00:00:00Z', events: 1, failures: 0 },
              { bucket: '2026-09-09T00:00:00Z', events: 2, failures: 0 }] };
    global.fetch = vi.fn(async (url: string) =>
      ({ ok: true, json: async () => (url.includes('/me') ? ME : daily) }) as unknown as Response,
    ) as unknown as typeof fetch;
    mount();
    await waitFor(() => expect(screen.getByText('Events per day')).toBeInTheDocument());
  });
});
