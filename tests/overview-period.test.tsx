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
import { TooltipProvider } from '@/components/ui/tooltip';
import type { OverviewMetrics } from '@/lib/api';
import OverviewPage from '../app/(dash)/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'team-one', role: 'admin' }], activeTeam: 'team-one',
};

// The gateway's real shape, hour-grained — the one the live page choked on.
//
// TYPED AGAINST THE INTERFACE, so a fixture cannot drift from the contract it stands in for.
// Untyped, this object carried `stages.complete` — the same wrong key the page rendered — so
// the test agreed with the bug and 158 of them passed while the live gateway sent `gated` and
// `closed` and eleven initiatives drew as nothing. A mock that is not held to the type is a
// second opinion from the same author.
const OVERVIEW: { metrics: OverviewMetrics } & Record<string, unknown> = {
  // The four the status row leads with. Figures only: every word on a tile is a fixed
  // label in the component, so a missing field here shows up as a broken tile, not as
  // prose quietly going missing.
  metrics: {
    progressing: {
      value: 66.7, active: 7, scoreable: 6,
      stages: { noflow: 1, notstarted: 0, drafting: 2, agreed: 1, gated: 1, closed: 2 },
      noDeltaBecause: 'approved_at is stored as a date',
    },
    knowledge: {
      value: 2.3, prev: 4.5, fromWork: 19, imported: 819, searches: 40,
      importThresholdPerHour: 50,
    },
    refusals: {
      value: 9.3, prev: 3.0, refused: 191, calls: 2064,
      byBlock: [{ block: 'casebox', n: 150 }, { block: 'core', n: 30 }, { block: '(platform)', n: 11 }],
    },
    context: {
      value: 43, prev: 37, p90: 989,
      runs: [{ kb: 12, skill: 'sdlc-spec' }, { kb: 989, skill: 'sdlc-plan' }],
      unmeasured: 1,
      contextWindowKb: 800,
    },
  },
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
        <TooltipProvider>
          <OverviewPage />
        </TooltipProvider>
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
    // A tile's value proves `metrics` was read; the panel title proves `grain` was.
    // `9.3%` is the refusal rate — the one number on this page somebody acts on.
    await waitFor(() => expect(screen.getByText('9.3%')).toBeInTheDocument());
    expect(screen.getByText('Events per hour')).toBeInTheDocument();
    // All four tiles, and each labelled by the question it answers rather than by a
    // count the platform happens to hold.
    for (const label of ['Initiatives progressing', 'Knowledge from work',
                         'Refusal rate', 'Context pulled per run']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
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
