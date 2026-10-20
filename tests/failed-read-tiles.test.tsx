import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

import { RunsView } from '@/views/pages/runs';

const TooltipProvider = Tooltip.Provider;

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} }),
}));

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
        <TooltipProvider><RunsView served={{ state: 'failed', path: '/runs?limit=10&offset=0', reason: 'the gateway could not reach its database' }} /></TooltipProvider>
      </QueryClientProvider>,
    );
    // The server's one read failed, so the page says so once, with the gateway's sentence, and nothing says "coming".
    expect(screen.getByText('The runs did not load')).toBeInTheDocument();
    expect(screen.getByText('the gateway could not reach its database')).toBeInTheDocument();
    expect(screen.queryByText('…')).toBeNull();
  });
});
