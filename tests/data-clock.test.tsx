import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDataClock } from '@/lib/api';

// The data's clock is the oldest arrival among the page's own reads. The shell's `/me`, read once and kept across
// client navigations, and a previous page's reads, kept in the cache after it unmounted, are not the page's.
const T = Date.parse('2026-10-31T10:00:00Z');
const MIN = 60_000;

function Watch({ path }: { path: string }) {
  useQuery({ queryKey: ['console', path], queryFn: async () => null, enabled: false });
  return null;
}
function Clock() {
  return <output>{useDataClock().toISOString()}</output>;
}

describe('the data clock', () => {
  it('is the oldest arrival among the queries on screen, the shell\'s identity read left out', () => {
    const client = new QueryClient();
    client.setQueryData(['console', '/me'], { email: 'a@b.example.com' }, { updatedAt: T });
    client.setQueryData(['console', '/previous-page'], { rows: [] }, { updatedAt: T + 5 * MIN });
    client.setQueryData(['console', '/initiatives'], { rows: [] }, { updatedAt: T + 20 * MIN });
    client.setQueryData(['console', '/initiatives/summary'], { tiles: {} }, { updatedAt: T + 21 * MIN });
    render(
      <QueryClientProvider client={client}>
        <Watch path="/me" /><Watch path="/initiatives" /><Watch path="/initiatives/summary" /><Clock />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status').textContent).toBe(new Date(T + 20 * MIN).toISOString());
  });
});
