import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tooltip } from 'radix-ui';

import { PeriodProvider } from '@/console/period';
import { WaitingPanel } from '@/console/waiting';

const TooltipProvider = Tooltip.Provider;

/**
 * A read that failed must not read as an all-clear.
 *
 * `WaitingPanel` is the one panel on the Overview whose whole job is to say a person is needed,
 * and its only two outcomes were "here they are" and "every written gate is signed". A failed
 * read leaves `q.data` undefined, so it drew the second: the panel said nobody is needed, on the
 * strength of a read that never answered. The two states are separate branches now, and this
 * pins them apart — a failure names itself and offers the Retry every other failed read offers,
 * and only an answered, empty list says every gate is signed.
 */

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PeriodProvider>
        <TooltipProvider><WaitingPanel /></TooltipProvider>
      </PeriodProvider>
    </QueryClientProvider>,
  );
}

const answers = (ok: boolean, status: number, body: unknown) =>
  vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);

describe('the waiting panel, read', () => {
  it('says the read failed, and never that every gate is signed', async () => {
    vi.stubGlobal('fetch', answers(false, 500, { error: 'the gateway could not reach its database' }));
    show();
    expect(await screen.findByText('The waiting gates did not load')).toBeInTheDocument();
    expect(screen.getByText('the gateway could not reach its database')).toBeInTheDocument();
    expect(screen.queryByText('Every written gate is signed')).toBeNull();
  });

  it('says every gate is signed when the read answered with nothing waiting', async () => {
    vi.stubGlobal('fetch', answers(true, 200, { waiting: [] }));
    show();
    expect(await screen.findByText('Every written gate is signed')).toBeInTheDocument();
    expect(screen.queryByText('The waiting gates did not load')).toBeNull();
  });
});
