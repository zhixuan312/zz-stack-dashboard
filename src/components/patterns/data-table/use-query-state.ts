'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react';

import { addressAnnouncements, addressSearch, announceAddress, subscribeAddress } from '@/lib/address';

/**
 * A view's state, kept in its address. Every key is a query parameter; a key at its default is left out of the URL,
 * so the plain address is the default view. A person shares the link and an agent opens the same view by calling a
 * tool with the same names. Writes replace the history entry and never scroll.
 *
 * The address is read through `lib/address.ts`, which says why it is `window` rather than `useSearchParams` — it is
 * the difference between a page that ships its own text and one that paints it after hydration.
 */
export function useQueryState<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void, boolean] {
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

  // The address changes only when the navigation commits, which waits on the server; `pending` says the rows are on
  // their way.
  const [pending, startTransition] = useTransition();

  /* Tell the address readers once the navigation has committed — not inside the transition, which is where this used
   * to be and why every filter took two presses.
   *
   * `router.replace` does not update `window.location` until the navigation commits, so a notify called beside it
   * hands the readers the address as it still is, and `state` is built from that read: measured on `/initiatives`,
   * pressing "Waiting on you" landed `?show=waiting` in the address on the first press with the control still reading
   * "All". Upstream's own copy reads Next's `useSearchParams`, which is why it does not have this — that hook is the
   * value this file replaced to get the pages' prerender back, and this is the half of it that had to come with the
   * replacement.
   *
   * The ref, rather than `[pending]` alone, so a mount does not announce an address nothing moved. */
  const moved = useRef(false);
  useEffect(() => {
    if (pending) { moved.current = true; return; }
    if (!moved.current) return;
    moved.current = false;
    announceAddress();
  }, [pending]);

  /* A write is shown from the moment it is made until the readers are told the address has moved, and never un-shown
   * in between, so a sort arrow or a page number answers the press and stays answered.
   *
   * COUPLED: the announcement in the effect above. The transition settles one render BEFORE that effect runs, and in
   * that render `state` is still the address as it was before the write. `useOptimistic`, which this used to be, lets
   * go when the transition settles, so for that one render the hook handed back the old value and then the new one
   * again. The release's `useSearchDraft` follows this state in render and took the old value for a change from
   * elsewhere: measured on `/teams`, a key typed up to 40 ms after the search box's own write was thrown away in 15
   * of 24 trials. So the write is kept beside the count of announcements it was made at, and laid over the state
   * while its navigation is on its way and then until that count moves — which is the effect above, or a back-press
   * or another writer after it, never the transition settling. */
  const told = useSyncExternalStore(subscribeAddress, addressAnnouncements, () => 0);
  const [asked, setAsked] = useState<{ at: number; patch: Partial<T> } | null>(null);
  const shown = useMemo(() => {
    if (!asked || (!pending && asked.at !== told)) return state;
    const out = { ...state };
    for (const [k, v] of Object.entries(asked.patch)) (out as Record<string, string>)[k] = v === undefined || v === '' ? (defaults[k] ?? '') : (v as string);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, asked, told, pending, key]);

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
      // Two writes before the readers are told once are one view: the second is laid over the first.
      const at = addressAnnouncements();
      setAsked((was) => ({ at, patch: was?.at === at ? { ...was.patch, ...patch } : patch }));
      startTransition(() => {
        // Through the router, so Next's own copy catches up. The address readers are told when this commits, by the
        // effect above — beside this line it was called a navigation too early, and every filter needed two presses.
        router.replace(q ? `${path}?${q}` : path, { scroll: false });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, router, key],
  );
  return [shown, set, pending];
}
