import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tooltip } from 'radix-ui';

/**
 * The figures the runs page leads with are the data's — the third page of `standard.md`'s floor, "the numbers the pages
 * show are the data's", after `people-figures` and `knowledge-figures`.
 *
 * What it pins: the three tiles — the team's runs since its first, the observed output per run with the runs nothing
 * measured beside it, and the largest run with its skill — each scoped from its heading, because a bare number matches
 * a column and a row on the same page as well as the tile. And what a run's bytes are called: observed output, never
 * a payload moved, the context a model read, or a cost.
 *
 * DELIBERATE: small, round numbers. A large one would be abbreviated by the tile's own `fitFigure` — 1024 becomes "1K" —
 * and the test would then be asserting the formatter rather than the data. The output is the one figure the gateway may
 * answer as null, and a page that showed a null as a confident 0 would be wrong in the direction that matters.
 */
import { PeriodProvider } from '@/console/period';
import type { RunRow, Runs } from '@/lib/destination-shapes';
import { RunsView } from '@/views/pages/runs';

const TooltipProvider = Tooltip.Provider;

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

const META = { asOf: '2026-10-15T00:00:00Z', timezone: 'UTC', period: { from: '2026-09-07T00:00:00Z', to: '2026-10-15T00:00:00Z' }, scope: 'active-team' as const, population: 'atlas', coverageFrom: null };
const LARGEST: RunRow = {
  id: 'r1', skill: 'sdlc-execute', initiative: '2026-10-03-ranking-weights', startedAt: '2026-10-11T00:00:00Z', lastCallAt: '2026-10-11T02:00:00Z',
  calls: 140, refusals: 9, bytes: 2_097_152, lengthMs: 7_200_000, state: 'last_call',
};

/* Runs, the output per run (512 KB) and the largest run (2 MB) are three different numbers, and two runs measured nothing. */
const RUNS = (output: number | null): Runs => ({
  meta: META, since: '2026-09-16T00:00:00Z',
  tiles: { runs: { value: 42, why: null }, outputPerRun: { value: output, why: output === null ? 'no_data' : null, unmeasured: 2 }, largest: output === null ? null : LARGEST },
  coverage: { coverageMs: 3_600_000, summedMs: 5_400_000, peak: 2, oneCall: 3 },
  bySkill: { state: 'ok', data: { rows: [{ skill: 'sdlc-execute', runs: 42, callsPerRun: 12.5, shareRefused: 0.05, outputPerRun: output, typicalMs: 600_000, timed: 39 }] } },
  recent: { state: 'ok', data: { rows: [LARGEST], total: 42 } },
});

let answer = RUNS(524_288);
function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const body = String(input).includes('/me') ? ME : answer;
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  answer = RUNS(524_288);
  window.history.replaceState(null, '', '/runs');
  global.fetch = mockFetch() as unknown as typeof fetch;
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <TooltipProvider>
          <RunsView />
        </TooltipProvider>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

describe('the figures on the runs page', () => {
  it('counts the runs, their observed output and the largest run the data holds', async () => {
    mount();
    // Waited on the FIGURE, not on the tile's note: the note is a fixed sentence and is on the page before the read
    // resolves, so waiting for it and then reading the figure meets the pending `…`.
    await waitFor(() => expect(figure('Runs')).toBe('42'));
    expect(figure('Observed output per run')).toBe('512 KB');
    expect(figure('Largest run')).toBe('2.0 MB');
    expect(text()).toContain('2 not measured');
    expect(text()).toContain('sdlc-execute');
  });

  it('says output nothing measured is not measured, never a zero', async () => {
    answer = RUNS(null);
    mount();
    await waitFor(() => expect(figure('Runs')).toBe('42'));
    expect(figure('Observed output per run')).toBe('Not measured');
    expect(figure('Largest run')).toBe('None measured');
  });

  it('calls a run\'s bytes observed output, and never a payload, a context or a cost', async () => {
    mount();
    await waitFor(() => expect(figure('Runs')).toBe('42'));
    expect(text()).not.toMatch(/payload|context|cost/i);
  });
});
