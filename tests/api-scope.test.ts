import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Which browser reads carry `scope=platform` (`withScope` in `src/lib/api.ts`). A superadmin in the platform view asks
 * every read under the platform's name and the gateway decides it; the search is the one it refuses that way, because
 * the platform runs it as the team the caller acts for. So a superadmin's search goes out with no scope, exactly as the
 * console's server asks it (`gatewayGet`), and every other read keeps it.
 *
 * Outside `ConsoleModeProvider` the mode is the platform's, which is a superadmin's default.
 */
import { useConsole } from '@/lib/api';

const asked: string[] = [];
beforeEach(() => {
  asked.length = 0;
  global.fetch = (async (input: RequestInfo | URL) => {
    asked.push(String(input));
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as typeof fetch;
});

function Read({ path }: { path: string }) {
  useConsole(path);
  return null;
}

function read(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(Read, { path })));
}

describe('a superadmin\'s browser reads in the platform view', () => {
  it('send the search with no platform scope', async () => {
    read('/search?q=rotate+the+signing+key&limit=10');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toBe('/api/console/search?q=rotate+the+signing+key&limit=10');
  });

  it('keep the platform scope on every other read', async () => {
    read('/knowledge?limit=10&offset=0');
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toBe('/api/console/knowledge?limit=10&offset=0&scope=platform');
  });
});
