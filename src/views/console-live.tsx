'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useWaitingApprovals, waitingRevisions } from '@/console/waiting-gates';
import { LiveProvider, useLive } from '@/lib/live';
import { useConsole } from '@/lib/api';
import type { Me } from '@/lib/api-shapes';

/** The endpoint the gateway serves the stream at: the console's own read surface, behind Caddy, as every other read is. */
const ENDPOINT = '/api/console/live';

/**
 * The reads whose collection is another's: what changes them is a change the gateway names by that other collection.
 * Approvals is read from the documents' revisions, and an approval or a presentation is a change to a document, which
 * the gateway names `initiatives`. Access is the caller's own tokens and browsers, which the gateway names `settings`.
 */
const KEPT_UNDER: Record<string, string> = { approvals: 'initiatives', access: 'settings' };

/**
 * The collection a console read belongs to: its first path segment, past the leading slash and any query, or the one
 * `KEPT_UNDER` names for it. `/initiatives/atlas/2026-09-28-search-relevance` reads `initiatives`; `/approvals?tab=waiting`
 * reads `initiatives` too.
 */
function collectionOf(path: string): string {
  const head = path.split('?')[0]?.split('/').filter(Boolean)[0] ?? '';
  return KEPT_UNDER[head] ?? head;
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
 * either side of the wire, but for the reads `KEPT_UNDER` names.
 *
 * `scopeKey` is a reset key for the browser and never proof of access, which is why it is the person rather than
 * anything the stream is trusted with: a new one disposes the old stream and its state, and an empty one opens
 * nothing. It stays empty until `/me` answers, so a signed-out tab opens no stream at all, and it changes when someone
 * else signs in on the same machine. A team switch replaces the document, so it needs no key of its own.
 *
 * For a caller the console reads for, it also waits for the bell's read (`BellLive`): the tab's first stream is the one
 * that asks with the revisions the page was served, and the bell's read is the one read on every page that the
 * console's server did not make, so the stream opens once it has answered and can ask with its revision too.
 */
export function ConsoleLive({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const me = useConsole<Me>('/me');
  const [bellAnswered, setBellAnswered] = useState(false);
  const mayRead = !!me.data?.mayRead;

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
    <LiveProvider refresh={refresh} endpoint={ENDPOINT} scopeKey={me.data && (!mayRead || bellAnswered) ? me.data.email : ''}>
      {mayRead ? <Suspense fallback={null}><BellLive onAnswered={setBellAnswered} /></Suspense> : null}
      {children}
    </LiveProvider>
  );
}

/**
 * The bell's collection on the live stream, beside the bell's read (`src/console/frame.tsx` draws what it answers): an
 * approval or a presentation changes a document, which the platform names `initiatives`, and the Approvals read is kept
 * under that collection. Without it the bell keeps a count nothing ever corrects.
 *
 * It registers with the revision the read was answered at, and says when the read has answered, either way, so the
 * stream opens after the registration that carries it: a child's effects run before the provider's, and the provider
 * opens the stream on the commit after this one. A read that failed hands no revision, and the stream resyncs the bell's
 * collection, which reads it again. Its own boundary: the read is keyed by who the page is read by, which a page's own
 * content never waits for.
 */
function BellLive({ onAnswered }: { onAnswered: (answered: boolean) => void }) {
  const q = useWaitingApprovals();
  const answered = q.isSuccess || q.isError;
  useLive(['initiatives'], q.isSuccess ? waitingRevisions() : undefined);
  useEffect(() => { if (answered) onAnswered(true); }, [answered, onAnswered]);
  return null;
}
