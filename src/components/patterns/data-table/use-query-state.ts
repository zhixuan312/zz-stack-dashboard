'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { addressSearch, announceAddress, subscribeAddress } from '@/lib/address';

/**
 * A view's state, kept in its address. Every key is a query parameter; a key at its default is left out of the URL,
 * so the plain address is the default view. A person shares the link and an agent opens the same view by calling a
 * tool with the same names. Writes replace the history entry and never scroll.
 *
 * The address is read through `lib/address.ts`, which says why it is `window` rather than `useSearchParams` — it is
 * the difference between a page that ships its own text and one that paints it after hydration.
 */
export function useQueryState<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const path = usePathname();
  const key = JSON.stringify(defaults);

  // A string, so the snapshot is a value React can compare rather than a fresh object it would re-read forever.
  const search = useSyncExternalStore(subscribeAddress, addressSearch, () => '');

  const state = useMemo(() => {
    const params = new URLSearchParams(search);
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v !== null) (out as Record<string, string>)[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, key]);

  const set = useCallback(
    (patch: Partial<T>) => {
      // The address as it stands at the moment of the write, not this render's snapshot of it: a
      // period chosen and a filter pressed in quick succession would otherwise rebuild from the
      // address as it was before the first of them, and drop what it wrote.
      const next = new URLSearchParams(addressSearch());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
        else next.set(k, v as string);
      }
      const q = next.toString();
      // Through the router, so Next's own copy catches up on the first filter change; and the readers
      // are told here as well, because a write that leaves the view unchanged navigates nowhere.
      router.replace(q ? `${path}?${q}` : path, { scroll: false });
      announceAddress();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, router, key],
  );
  return [state, set];
}
