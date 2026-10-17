'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
// The address reader alone, not the table's module: the pages that only follow a read would carry the whole table.
import { useQueryState } from '@/components/patterns/data-table/use-query-state';
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

const never = () => () => {};

/**
 * The address a page draws, beside the setter that moves it. The address reader's server snapshot is its defaults, so on
 * the console's server and while the page hydrates it would say the plain address whatever the address was, and the
 * first paint of a filtered address, a tab or a later page would be the page's loading state, or the default control,
 * though the server read exactly that address. Until the browser knows its own address, the address is `read`, the one
 * the console's server read; from then on it is the address itself, which on a first load is the same one. With no
 * server read in hand it is the address from the start.
 */
export function useAddress<T extends Record<string, string>>(defaults: T, read: T | null): [T, (patch: Partial<T>) => void] {
  const [addressed, set] = useQueryState(defaults);
  const hydrated = useSyncExternalStore(never, () => true, () => false);
  return [hydrated || read === null ? addressed : read, set];
}

/** `useAddress` for a page whose server read follows its address: the address read back from the read's path by the page's own `filtersOfPath`. */
export function useServedAddress<T extends Record<string, string>>(
  defaults: T, served: { path: string } | null, filtersOfPath: (path: string) => T,
): [T, (patch: Partial<T>) => void] {
  const path = served?.path ?? null;
  const read = useMemo(() => (path === null ? null : filtersOfPath(path)), [path, filtersOfPath]);
  return useAddress(defaults, read);
}
