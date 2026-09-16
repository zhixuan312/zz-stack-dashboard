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
import type { Overview } from '@/lib/api';
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
/* THE WHOLE FIXTURE, not just `metrics`. It was `{ metrics: OverviewMetrics } &
 * Record<string, unknown>`, which held the four tiles to the contract and let every panel
 * below them drift — and `Record<string, unknown>` makes each of those fields `unknown`,
 * so even spreading one in a test is an error. Typing the whole object is what the
 * paragraph above asks for. */
const OVERVIEW: Overview = {
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
      byDoor: [{ door: 'core', n: 150 }, { door: 'eval', n: 30 }, { door: 'manage', n: 11 }],
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
  timezone: 'Asia/Singapore',
  toolTrend: [
    { bucket: '2026-09-09T04:00:00Z', inside: 200, outside: 111, refused: 9 },
    { bucket: '2026-09-09T05:00:00Z', inside: 250, outside: 149, refused: 12 },
  ],
  eventKinds: [{ kind: 'tool_call', n: 8551, failed: 1761 }],
  refusals: {
    total: 21,
    byTool: [{ tool: 'core:knowledge_add', n: 18 }, { tool: 'core:document_write', n: 3 }],
    // Deliberately BELOW the concentration threshold — 18 of 21 is 86%, so flip it to
    // prove the banner appears, and leave the default case quiet. See the two tests below.
    byMessage: [{ message: 'ERROR: already closed', tool: 'core:initiative_close', tools: 1, n: 8 }],
  },
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
    expect(screen.getByText('Tool calls over time')).toBeInTheDocument();
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

  /* THE BUCKET IS LABELLED ON THE DEPLOYMENT'S CALENDAR, not on UTC's and not on the
   * machine running the test. `2026-09-14T16:00:00Z` is midnight on the 15th in Singapore
   * and still the 14th in UTC — so the two answers differ by a day, which is exactly the
   * mistake being guarded against, and the assertion holds wherever CI happens to run. */
  it('labels a bucket in the timezone the payload names', async () => {
    const daily = { ...OVERVIEW, grain: 'day' as const,
      toolTrend: [{ bucket: '2026-09-13T16:00:00Z', inside: 1, outside: 0, refused: 0 },
                  { bucket: '2026-09-14T16:00:00Z', inside: 2, outside: 0, refused: 0 }] };
    global.fetch = vi.fn(async (url: string) =>
      ({ ok: true, json: async () => (url.includes('/me') ? ME : daily) }) as unknown as Response,
    ) as unknown as typeof fetch;
    const { container } = mount();
    await waitFor(() => expect(screen.getByText('Tool calls over time')).toBeInTheDocument());
    const labels = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    /* The two buckets are `09-14 · 09-15` on Singapore's calendar and `09-13 · 09-14` on
       UTC's, so each calendar has one label the other cannot produce. Asserting the
       OVERLAP (`09-14`) would pass either way, which is how the first draft of this test
       reported a bug that was not there. */
    expect(labels).toContain('09-15');     // only Singapore says this
    expect(labels).not.toContain('09-13'); // only UTC says this
  });

  it('states the grain that came back, not a hardcoded one', async () => {
    // A day-grained response must not still say "per hour" — the grain is data, not a
    // constant, and this is the assertion that keeps it that way.
    const daily = { ...OVERVIEW, grain: 'day',
      toolTrend: [{ bucket: '2026-09-08T00:00:00Z', inside: 1, outside: 0, refused: 0 },
                  { bucket: '2026-09-09T00:00:00Z', inside: 2, outside: 0, refused: 0 }] };
    global.fetch = vi.fn(async (url: string) =>
      ({ ok: true, json: async () => (url.includes('/me') ? ME : daily) }) as unknown as Response,
    ) as unknown as typeof fetch;
    mount();
    await waitFor(() => expect(screen.getByText(/one bar per day/)).toBeInTheDocument());
  });

  /* THE CALLOUT IS THE PART THAT CAN BE WRONG IN BOTH DIRECTIONS, so both are asserted.
   * A banner reading "38% is one error message" is a headline for a non-story, and a
   * panel that always shouts teaches a reader to stop looking at it. */
  it('stays quiet when no single message dominates the refusals', async () => {
    mount();                                        // 8 of 21 — 38%, below the threshold
    await waitFor(() => expect(screen.getByText('Where it refuses')).toBeInTheDocument());
    expect(screen.queryByText('one error message')).not.toBeInTheDocument();
  });

  it('calls out a message that is most of the refusals', async () => {
    const concentrated = { ...OVERVIEW,
      refusals: { ...OVERVIEW.refusals,
        byMessage: [{ message: 'ERROR: already closed', tool: 'core:initiative_close', tools: 1, n: 18 }] } };
    global.fetch = vi.fn(async (url: string) =>
      ({ ok: true, json: async () => (url.includes('/me') ? ME : concentrated) }) as unknown as Response,
    ) as unknown as typeof fetch;
    mount();                                        // 18 of 21 — 86%
    /* THE `<b>`, not the sentence. The banner reads "86% is <b>one error message</b> from
     * …", so the sentence is split across elements and a regex over the whole of it
     * matches nothing — which looks like the banner is absent when it is present. */
    await waitFor(() => expect(screen.getByText('one error message')).toBeInTheDocument());
    /* TWO ELEMENTS READ 86% NOW and this test means the headline one. The bar list states
     * every row's share beside its count, and core:knowledge_add is 18 of the same 21 — the
     * same fact told once as a finding and once as a ranking. A bare getByText matched both
     * and threw "found multiple elements", which reads as the banner being broken. */
    const headline = screen.getAllByText('86%').find((el) => el.tagName === 'B');
    expect(headline).toBeDefined();
  });

  /* THE SHARE IS THE WHOLE POINT OF PASSING A TOTAL, and it is computed against the total
   * the payload states rather than against the rows drawn — `limit` caps the drawing. */
  it('states each refusal row as a share of the period total', async () => {
    mount();
    await waitFor(() => expect(screen.getByText('Where it refuses')).toBeInTheDocument());
    expect(screen.getByText('86%')).toBeInTheDocument();   // core:knowledge_add, 18 of 21
    expect(screen.getByText('14%')).toBeInTheDocument();   // core:document_write, 3 of 21
  });
});
