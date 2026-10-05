import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

import { PeriodProvider } from '@/console/period';
import RunsPage from '../app/(dash)/runs/page';

const TooltipProvider = Tooltip.Provider;

/**
 * A read that failed must not look like one still on its way.
 *
 * Every tile drew `…` for a value that had not arrived, whether it was coming or
 * the read had failed — so on a page left open, a failure read as "wait a moment"
 * for ever. The mark is a fact about the read: `…` is coming, `—` is not, and the
 * gateway's own sentence says why.
 */
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: false, status: 500,
    json: async () => ({ error: 'the gateway could not reach its database' }),
  }) as unknown as Response));
});

describe('every read on a page failing', () => {
  it('shows no ellipsis — a dash, and the reason', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PeriodProvider>
          <TooltipProvider><RunsPage /></TooltipProvider>
        </PeriodProvider>
      </QueryClientProvider>,
    );
    // Both reads on this page report themselves: the totals, and the skill panel.
    await waitFor(() => expect(screen.getAllByText(/did not load/).length).toBeGreaterThan(1));
    // The tiles have settled, and none of them says "coming".
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText('…')).toBeNull();
  });
});
