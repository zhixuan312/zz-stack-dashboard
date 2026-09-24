import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The overview page actually renders, against the response shape the gateway actually sends.
 *
 * A field renamed in the gateway makes the page call `.map` on a field that no longer exists, and
 * the route error boundary swallows the whole frame, period picker included.
 *
 * It asserts the two things a shape mismatch breaks first: that the page renders at all, and that
 * the period reaches the request as a parameter rather than being dropped.
 *
 * Mounted inside a real `PeriodProvider` rather than against a mocked router, because the provider
 * is the mechanism under test.
 */
// `@` aliases src/, and the page lives under app/ — relative, so no alias is invented
// for one test file.
import { PeriodProvider } from '@/components/PeriodProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Overview } from '@/lib/api-shapes';
import OverviewPage from '../app/(dash)/page';

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'team-one', role: 'admin' }], activeTeam: 'team-one',
};

// The gateway's real shape, hour-grained.
//
// Typed against the interface, so a fixture cannot drift from the contract it stands in for. An
// untyped fixture can carry the same wrong key the page renders, and the test then agrees with the
// bug.
/* The whole fixture, not just `metrics`: `{ metrics: OverviewMetrics } & Record<string, unknown>`
 * holds the four tiles to the contract while every panel below them drifts, and makes each of those
 * fields `unknown`, so even spreading one in a test is an error. */
const OVERVIEW: Overview = {
  // The four the status row leads with. Figures only: every word on a tile is a fixed
  // label in the component, so a missing field here shows up as a broken tile, not as
  // prose quietly going missing.
  metrics: {
    progressing: {
      value: 66.7, active: 7, scoreable: 6,
      stages: { noflow: 1, notstarted: 0, drafting: 2, agreed: 1, gated: 1, closed: 2 },
      // 3 gates written and unapproved, the oldest sitting 3.9 days. 12 explore.md documents are
      // also unapproved and are deliberately not here — see the test below.
      waiting: 3, waitingOldestDays: 3.9,
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
      unmeasured: 1, capped: false,
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
  eventKinds: [{ kind: 'tool_call', n: 8551 }],
  refusals: {
    total: 21,
    byTool: [{ tool: 'core:knowledge_add', n: 18 }, { tool: 'core:document_write', n: 3 }],
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

  /* The bucket is labelled on the deployment's calendar, not on UTC's and not on the machine
   * running the test. `2026-09-14T16:00:00Z` is midnight on the 15th in Singapore and still the
   * 14th in UTC, so the assertion holds wherever CI happens to run. */
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
    /* The two buckets are `09-14 · 09-15` on Singapore's calendar and `09-13 · 09-14` on UTC's, so
       each calendar has one label the other cannot produce. Asserting the overlap (`09-14`) would
       pass either way. */
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

  /* The one figure on this page naming something a person can unblock, so it has to be on the face
   * and countable — a tile that states it only in the help popover states it to nobody. */
  it('states what is waiting on a person, and for how long', async () => {
    mount();
    await waitFor(() => expect(screen.getByText(/Initiatives progressing/)).toBeInTheDocument());
    expect(screen.getByText(/3 awaiting \(3.9d\)/)).toBeInTheDocument();
  });

  /* Nothing waiting is not a clause reading "0 waiting". A tile that always carries the sentence
   * trains the reader past it, so the clause has to disappear when there is nothing to say. */
  it('drops the clause entirely when no gate is waiting', async () => {
    const clear = { ...OVERVIEW,
      metrics: { ...OVERVIEW.metrics,
        progressing: { ...OVERVIEW.metrics.progressing, waiting: 0, waitingOldestDays: null } } };
    global.fetch = vi.fn(async (url: string) =>
      ({ ok: true, json: async () => (url.includes('/me') ? ME : clear) }) as unknown as Response,
    ) as unknown as typeof fetch;
    mount();
    await waitFor(() => expect(screen.getByText(/Initiatives progressing/)).toBeInTheDocument());
    expect(screen.queryByText(/awaiting/)).not.toBeInTheDocument();
    // …and the sublabel it shares a line with survives intact.
    //
    // `6 of 7 active`, never "6 open". `scoreable` is the open initiatives that declare a flow —
    // the only population a completeness median can be taken over.
    expect(screen.getByText(/^6 of 7 active/)).toBeInTheDocument();
  });

  /* The share is the whole point of passing a total, and it is computed against the total
   * the payload states rather than against the rows drawn — `limit` caps the drawing. */
  it('states each refusal row as a share of the period total', async () => {
    mount();
    await waitFor(() => expect(screen.getByText('Refusals')).toBeInTheDocument());
    // The share is on the bar, read on hover and by a screen reader.
    expect(screen.getByLabelText('86% of 21')).toBeInTheDocument();   // core:knowledge_add
    expect(screen.getByLabelText('14% of 21')).toBeInTheDocument();   // core:document_write
  });
});
