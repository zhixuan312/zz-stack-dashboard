import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tooltip } from 'radix-ui';

/**
 * The figures the runs page leads with are the data's — the third page of `standard.md`'s floor, "the numbers the pages
 * show are the data's", after `people-figures` and `knowledge-figures`.
 *
 * What it pins: the three figures that cannot be reached by counting something else — runs recorded, the refusals
 * beside them, and the payload moved. The refusals are asserted through the tile's NOTE, which the repo's own pattern
 * does (`overview-period.test.tsx:119`), and the other two through the tile's figure, scoped from its heading because a
 * bare number matches a column and a row on the same page as well as the tile.
 *
 * DELIBERATE: three small, round numbers, and one that is not a whole number. A large one would be abbreviated by the
 * tile's own `fitFigure` — 1024 becomes "1K" — and the test would then be asserting the formatter rather than the data.
 * The fraction is there because the payload is the one figure the gateway may report as null, and a page that showed a
 * null as a confident 0 would be wrong in the direction that matters.
 */
import { PeriodProvider } from '@/console/period';
import type { Runs } from '@/lib/api-shapes';
import { RunsView } from '@/views/pages/runs';

const TooltipProvider = Tooltip.Provider;

const ME = {
  email: 'a@b.example.com', name: 'A', role: 'superadmin', mayRead: true, superadmin: true,
  via: 'session', teams: [{ slug: 'atlas', role: 'admin' }], activeTeam: 'atlas',
};

/* Runs and calls deliberately differ, and refusals is neither of them: a page that showed the call count in the
 * refusals note would still render. */
const RUNS: Runs = { totals: { runs: 42, calls: 120, refusals: 7, mb: 12.3 } };

function mockFetch() {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes('/me') ? ME : url.includes('/skills') ? { skills: [] } : RUNS;
    return { ok: true, json: async () => body } as unknown as Response;
  };
}

/** The figure of the tile whose label is `label`: the first `<p>` inside its card, beside the heading. */
function figure(label: string): string {
  const all = [...document.querySelectorAll('h2')];
  const mine = all.find((h) => h.textContent?.trim() === label);
  return mine?.closest('div')?.parentElement?.querySelector('p')?.textContent?.trim() ?? '';
}

const text = () => document.body.textContent ?? '';

beforeEach(() => {
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
  it('says how many calls were refused, which is neither the run count nor the call count', async () => {
    mount();
    await waitFor(() => expect(text()).toContain('7 refused'));
    expect(text()).not.toContain('42 refused');
    expect(text()).not.toContain('120 refused');
  });

  it('counts the runs and the payload the data holds', async () => {
    mount();
    // Waited on the FIGURE, not on the tile's note: the note is a fixed sentence and is on the page before the read
    // resolves, so waiting for it and then reading the figure meets the pending `…`.
    await waitFor(() => expect(figure('Runs')).toBe('42'));
    // The payload is the one figure the gateway may report as null, so it is the one a page is most likely to render as
    // a confident zero. No space between the number and its unit: the unit is a `<span>` beside the figure, stepped down
    // and spaced by the stylesheet, so the text is `12.3MB` and the gap is layout rather than a character.
    expect(figure('Payload moved')).toBe('12.3MB');
  });
});
