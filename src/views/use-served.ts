'use client';

import { useQuery } from '@tanstack/react-query';
import { useConsole } from '@/lib/api';

/**
 * A read the console's server made, followed in the browser: no browser read of `path` while the server's answer is
 * the latest, and one as soon as something says it is not. The mark is a query under the read's own path, so a hint
 * that its collection changed reaches it as it reaches every browser read of that collection (`ConsoleLive`); it reads
 * nothing itself and is never stale on its own. Once it has moved, `path` is read in the browser like any other read,
 * and later hints refetch that read. `follow` moves it by hand, for a Retry of a server read that brought nothing.
 *
 * Teams and a team's page both follow their server read with it, so it lives here rather than in either page: a
 * page importing the other for it carried the other's whole first load.
 *
 * Off the served address (`served` false) the mark is idle and `path` is the browser's from the first render, unless
 * `waiting` says a navigation to it is on its way. A filter or a page of rows moves the address through the router, and
 * the console's server renders the page again with its own read of the new address, so the browser waits for that
 * answer rather than asking the gateway the same thing beside it. A page passes `waiting` when the server read it holds
 * is of another address than the one it draws: the address has moved and the server's answer has not arrived, or the
 * answer has arrived and the address this part of the page reads has not caught up with it yet. Both settle on their
 * own, and neither is a reason to read.
 */
export function useServed<T>(path: string, served: boolean, waiting = false) {
  const mark = useQuery({
    queryKey: ['console', path, 'served'],
    queryFn: () => Date.now(),
    initialData: 0,
    initialDataUpdatedAt: 0,
    staleTime: Infinity,
    retry: false,
    enabled: served,
  });
  const q = useConsole<T>((served ? mark.data > 0 : !waiting) ? path : null);
  return { q, follow: () => void mark.refetch() };
}
