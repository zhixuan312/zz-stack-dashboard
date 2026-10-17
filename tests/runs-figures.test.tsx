import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

/**
 * The figures the runs page leads with are the data's — the third page of `standard.md`'s floor, "the numbers the pages
 * show are the data's", after `people-figures` and `knowledge-figures`.
 *
 * What it pins: the three tiles — the team's runs since its first, the observed output per run with the runs nothing
 * measured beside it, and the largest run with its skill — each scoped from its heading, because a bare number matches
 * a column and a row on the same page as well as the tile. And what a run's bytes are called: observed output, never
 * a payload moved, the context a model read, tokens or a cost.
 *
 * DELIBERATE: small, round numbers. A large one would be abbreviated by the tile's own `fitFigure` — 1024 becomes "1K" —
 * and the test would then be asserting the formatter rather than the data. The output is the one figure the gateway may
 * answer as null, and a page that showed a null as a confident 0 would be wrong in the direction that matters.
 */
import type { RunRow, Runs } from '@/lib/destination-shapes';
import { RunsView } from '@/views/pages/runs';
import { RUNS_DEFAULTS, runsPath } from '@/views/runs-context';

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

/** The figure of the tile whose label is `label`: its value as drawn, a unit its own span. */
function figure(label: string): string {
  const mine = [...document.querySelectorAll('[data-figures="read"] h2')].find((h) => h.textContent?.trim() === label);
  return mine?.closest('.card')?.querySelector('[data-value]')?.textContent?.trim() ?? '';
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/runs');
  // The page's read is the server's: the browser is never asked, and a read it made would hang here.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

function mount(data: Runs) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Tooltip.Provider>
        <RunsView served={{ state: 'ok', path: runsPath(RUNS_DEFAULTS), data }} />
      </Tooltip.Provider>
    </QueryClientProvider>,
  );
}

describe('the figures on the runs page', () => {
  it('counts the runs, their observed output and the largest run the data holds', () => {
    mount(RUNS(524_288));
    expect(figure('Runs')).toBe('42');
    // A figure's unit is its own span, as on every tile, so its text runs on.
    expect(figure('Observed output per run')).toBe('512KB');
    expect(figure('Largest run')).toBe('2.0MB');
    expect(text()).toContain('2 not measured');
    expect(text()).toContain('sdlc-execute');
  });

  it('says output nothing measured is not measured, never a zero', () => {
    mount(RUNS(null));
    expect(figure('Runs')).toBe('42');
    expect(figure('Observed output per run')).toBe('Not measured');
    expect(figure('Largest run')).toBe('None measured');
  });

  it('calls a run\'s bytes observed output, and never a payload, a context, tokens or a cost', () => {
    mount(RUNS(524_288));
    expect(figure('Runs')).toBe('42');
    expect(text()).not.toMatch(/payload|context|token|cost/i);
  });
});
