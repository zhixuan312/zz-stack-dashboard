'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * A view's state, kept in its address. Every key is a query parameter; a key at its default is left out of the URL,
 * so the plain address is the default view. A person shares the link and an agent opens the same view by calling a
 * tool with the same names. Writes replace the history entry and never scroll.
 */
export function useQueryState<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const key = JSON.stringify(defaults);
  const state = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v !== null) (out as Record<string, string>)[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, key]);
  const set = useCallback(
    (patch: Partial<T>) => {
      // The address, not `params`. Next's search params are what it last NAVIGATED to, and the
      // reporting period is written with `history.replaceState` (`console/period.tsx`), which a
      // router never sees. Rebuilt from its own stale copy, this dropped `?period=` the moment a
      // person touched a filter: the shared link lost the window, and a reload fell back to the
      // default, because the period store's memory is a module variable a reload clears. Reading
      // the address is what that store does for the same reason, and the write below goes through
      // `router.replace`, so Next's copy catches up on the first filter change.
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
        else next.set(k, v as string);
      }
      const q = next.toString();
      router.replace(q ? `${path}?${q}` : path, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, router, key],
  );
  return [state, set];
}
