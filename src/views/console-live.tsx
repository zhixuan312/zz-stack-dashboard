'use client';

import { useCallback, type ReactNode } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { LiveProvider } from '@/lib/live';
import { useConsole, useConsoleMode } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';

/** The endpoint the gateway serves the stream at: the console's own read surface, behind Caddy, as every other read is. */
const ENDPOINT = '/api/console/live';

/**
 * The collection a console read belongs to: its first path segment, past the leading slash and any query.
 * `/initiatives/atlas/2026-09-28-search-relevance` reads `initiatives`; `/initiatives?waiting=1` reads the same one.
 */
function collectionOf(path: string): string {
  return path.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
}

/**
 * Every console page's live data: one stream per tab, opened once the caller is known, that says which collection
 * changed so the pages showing it are read again.
 *
 * This is the release's `src/views/console-live.tsx` with its one part replaced, and the replacement is what makes it
 * this product's. There, `refresh` calls a Server Action that drops the tenant's cached reads and then refreshes the
 * router. Here there is nothing on the server to drop: `src/lib/api.ts` reads from the browser, so the cache is React
 * Query's and dropping it is `invalidateQueries`. The names the gateway sends are collection names either way, and the
 * collection a read belongs to is its own first path segment — `/teams` reads `teams` — so no new vocabulary appears on
 * either side of the wire.
 *
 * `scopeKey` is a reset key for the browser and never proof of access, which is why it is the person and the scope in
 * view rather than anything the stream is trusted with: a new one disposes the old stream and its state, and an empty
 * one opens nothing. It stays empty until `/me` answers, so a signed-out tab opens no stream at all, and it changes
 * when someone else signs in on the same machine or the superadmin switches between the platform and one team.
 */
export function ConsoleLive({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { mode } = useConsoleMode();
  const me = useConsole<Me>('/me');

  /**
   * Reads the named collections again. The stream is telling the tab what it cannot see for itself — another tab or
   * another person changed something — so the answer already in the cache is the one thing that is certainly stale;
   * `invalidateQueries` marks it and refetches what is on screen.
   *
   * A rejection is the client's to turn into a state, never a throw out of here.
   */
  const refresh = useCallback(async (names: string[]) => {
    if (!names.length) return;
    const changed = new Set(names);
    await client.invalidateQueries({
      predicate: (q: Query) => q.queryKey[0] === 'console' && changed.has(collectionOf(String(q.queryKey[1] ?? ''))),
    });
  }, [client]);

  // No test hook for the safety poll: a check drives a change through a hint at a moment it chose, which is the
  // behaviour that matters, rather than waiting out the provider's own poll.
  return (
    <LiveProvider refresh={refresh} endpoint={ENDPOINT} scopeKey={me.data ? `${mode}:${me.data.email}` : ''}>
      {children}
    </LiveProvider>
  );
}
