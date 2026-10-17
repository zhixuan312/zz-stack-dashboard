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
 * Off the served address (`served` false) the mark is idle and `path` is the browser's from the first render.
 */
export function useServed<T>(path: string, served: boolean) {
  const mark = useQuery({
    queryKey: ['console', path, 'served'],
    queryFn: () => Date.now(),
    initialData: 0,
    initialDataUpdatedAt: 0,
    staleTime: Infinity,
    retry: false,
    enabled: served,
  });
  const q = useConsole<T>(!served || mark.data > 0 ? path : null);
  return { q, follow: () => void mark.refetch() };
}
